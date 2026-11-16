# Published Stable installers

User-facing notes are the [changelog](../CHANGELOG.md) and the version files in `docs/releases/`. This page keeps installer checksums those notes do not repeat.

Each SHA-256 is the GitHub release asset digest for that `Reprise_*_x64-setup.exe`. The 3.3.0, 3.3.1, and 3.3.2 values match the engineering notes that recorded them before those notes were removed. 3.1.0 and 3.1.1 stayed local packages. Their notes remain in the in-app history.

| Version | Installer | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| 3.4.3 | `Reprise_3.4.3_x64-setup.exe` | 4,583,733 | `27c7429fd5abdfb06fd6a16c0bd90b901904fc34b456837770b902d03232cc1c` |
| 3.4.2 | `Reprise_3.4.2_x64-setup.exe` | 4,582,913 | `161e0f162b6763585f560f2c7a725da8d4f1961743695844aa5cbd8c2ea90c2c` |
| 3.4.1 | `Reprise_3.4.1_x64-setup.exe` | 4,583,989 | `6e7b10e8b1747bd4f59e8a2c347292599e749dda7af5a6c47663e6da60c18a33` |
| 3.4.0 | `Reprise_3.4.0_x64-setup.exe` | 4,581,939 | `24006dccc1343d85f12bc6010922f7427726687bad32fd13a0da23aa2a2ad42c` |
| 3.3.3 | `Reprise_3.3.3_x64-setup.exe` | 4,553,784 | `45fd1d342cc712d739157797ece9376ecf76d5c1cc60895aca5ff7e9ee4a5123` |
| 3.3.2 | `Reprise_3.3.2_x64-setup.exe` | 4,554,627 | `76d1cac4e7cd59454961117dcc67624256a06dd546c298a7774891e5db042925` |
| 3.3.1 | `Reprise_3.3.1_x64-setup.exe` | 4,543,821 | `2d13c5929abaea22ac0ce2c1eb627de5411601f6b7774b4cbd14561e2706eaa6` |
| 3.3.0 | `Reprise_3.3.0_x64-setup.exe` | 4,539,860 | `7e475c2586ff53472104565f6cb21aa1fd5eadaca156d752614e30c621de080d` |
| 3.2.0 | `Reprise_3.2.0_x64-setup.exe` | 4,319,873 | `f297d9b19af3211e92721e0c45aabb902cf9cabf3b7d7eae0e66eade9f18c93f` |

The signed workflow [43327134809](https://github.com/Ninefarer/Reprise/actions/runs/43327134809) published `v3.3.2`. An unauthenticated fetch of the Latest manifest resolved to 3.3.2, and the public key verified that installer and its signed version. Updater signatures are Minisign signatures checked by the Tauri updater. See [signed updates](UPDATES.md).
