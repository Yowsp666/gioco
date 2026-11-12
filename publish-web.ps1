$ErrorActionPreference = 'Stop'

$repoRoot = (& git -C $PSScriptRoot rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0) {
    throw 'Esegui questo script da un repository Git.'
}
$repoRoot = $repoRoot.Trim()
$webPath = Join-Path $repoRoot 'web'
if (-not (Test-Path -LiteralPath $webPath -PathType Container)) {
    throw 'La cartella web non esiste.'
}

& git -C $repoRoot fetch origin main:refs/remotes/origin/main
if ($LASTEXITCODE -ne 0) {
    throw 'Impossibile aggiornare origin/main.'
}

$deployPath = Join-Path ([System.IO.Path]::GetTempPath()) ("gioco-pages-" + [guid]::NewGuid().ToString('N'))
$worktreeCreated = $false
try {
    & git -C $repoRoot worktree add --detach $deployPath refs/remotes/origin/main
    if ($LASTEXITCODE -ne 0) {
        throw 'Impossibile creare il worktree temporaneo di pubblicazione.'
    }
    $worktreeCreated = $true

    Get-ChildItem -LiteralPath $deployPath -Force |
        Where-Object { $_.Name -ne '.git' } |
        Remove-Item -Recurse -Force

    Get-ChildItem -LiteralPath $webPath -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $deployPath -Recurse -Force
    }

    & git -C $deployPath add -A
    if ($LASTEXITCODE -ne 0) {
        throw 'Impossibile preparare i file web per la pubblicazione.'
    }

    $expectedFiles = @(
        Get-ChildItem -LiteralPath $webPath -File -Recurse |
            ForEach-Object { $_.FullName.Substring($webPath.Length + 1).Replace('\', '/') } |
            Sort-Object
    )
    $publishedFiles = @(& git -C $deployPath ls-files)
    if ($LASTEXITCODE -ne 0) {
        throw 'Impossibile verificare i file preparati per la pubblicazione.'
    }
    if (($expectedFiles -join "`n") -cne ($publishedFiles -join "`n")) {
        throw 'Il contenuto preparato non corrisponde esattamente alla cartella web.'
    }

    & git -C $deployPath diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Output 'web/ non ha modifiche da pubblicare.'
    } elseif ($LASTEXITCODE -eq 1) {
        & git -C $deployPath commit -m 'Publish web to GitHub Pages'
        if ($LASTEXITCODE -ne 0) {
            throw 'Creazione del commit Pages fallita.'
        }

        & git -C $deployPath push origin HEAD:main
        if ($LASTEXITCODE -ne 0) {
            throw 'Pubblicazione su origin/main fallita.'
        }
    } else {
        throw 'Impossibile confrontare i file preparati con origin/main.'
    }
} finally {
    if ($worktreeCreated) {
        & git -C $repoRoot worktree remove --force $deployPath
        if ($LASTEXITCODE -ne 0) {
            throw 'Pulizia del worktree temporaneo fallita.'
        }
    }
}
