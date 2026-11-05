# YuE2 Studio

A local web studio for generating songs with **YuE2** (lyrics + style prompt → full song with vocals),
running the model on your own GPU through the [audio.cpp](https://github.com/0xShug0/audio.cpp) engine.

- **Generate**: composer with section-tag buttons, presets, target length, seed, CoT mode, and a live job queue
- **Gallery**: every song with search, favorites, flags, categories, genre/BPM/date filters, and bulk actions
- **Styles**: preset manager, A/B compare (same lyrics + seed across presets), songs grouped by style
- **Guide**: how to prompt YuE2, plus a Suno ↔ YuE2 mapping

Everything stays on your machine: SQLite database, WAV files, no accounts, no cloud.

## Requirements

| | Minimum | Recommended |
|---|---|---|
| OS | Windows 10/11 x64, Linux x64, or WSL2 | |
| GPU | Any Vulkan GPU, or CPU only (very slow) | NVIDIA GPU, 8 GB+ VRAM, CUDA |
| Disk | ~4 GB (q4_0 model + engine) | more for your songs (~10 MB per WAV minute) |
| Node.js | 20.19+ or 22.12+ | 22 LTS |

Linux CUDA builds compile the engine from source, so they also need `git`, `cmake`, GCC 13+, and the
NVIDIA CUDA Toolkit (`nvcc`). Windows uses prebuilt engine binaries, so it needs no compiler.

## Install

### Windows

1. Install [Node.js 22 LTS](https://nodejs.org) (the installer offers to do this with `winget` if it's missing).
2. Download this repo: **Code → Download ZIP** and extract it, or `git clone https://github.com/HanosThePlacid/yue2-studio`.
3. Double-click **`install.cmd`**, or run it from a terminal:
   ```bat
   install.cmd
   ```
4. Double-click **`start.cmd`**. Your browser opens at http://localhost:8000.

The installer:
- picks the **CUDA** backend if `nvidia-smi` finds an NVIDIA GPU (CUDA 13.3 build on driver 580+, CUDA 12.4 otherwise), or **Vulkan** if it doesn't
- downloads the prebuilt audio.cpp engine (plus CUDA runtime DLLs) into `engine/`
- downloads the YuE2 weights (~2.8 GB) from [Hugging Face](https://huggingface.co/audio-cpp/Yue2-3B-GGUF) into `models/`
- runs `npm ci` and `npm run build` in `app/`
- writes your settings to `.env`

Options: `install.cmd -Backend vulkan|cuda|cpu`, `-Model q4_0|q8_0|bf16`, `-EnginePath C:\path\audiocpp_cli.exe`, `-SkipModel`.

### Linux / WSL2

```bash
git clone https://github.com/HanosThePlacid/yue2-studio
cd yue2-studio
./install.sh
./start.sh          # http://localhost:8000
```

The installer:
- with `nvcc` installed: clones audio.cpp and **builds it with CUDA** (YuE2 only, so it's faster than a full build)
- otherwise: downloads the prebuilt **Vulkan** (or **CPU**) engine
- downloads the weights, builds the app, and writes `.env`, the same as on Windows

Options: `--backend cuda|vulkan|cpu`, `--model q4_0|q8_0|bf16`, `--engine-path /path/audiocpp_cli`,
`--skip-model`, `--cuda-arch native`.

On **WSL2** with an NVIDIA GPU, install the Windows NVIDIA driver plus the
[CUDA toolkit for WSL](https://docs.nvidia.com/cuda/wsl-user-guide/). Don't install a Linux driver inside WSL.
Keep the repo on the Linux filesystem (`~/...`) rather than `/mnt/c` for faster builds.

Re-running either installer is safe: it skips anything already downloaded or built.

### Manual install

If you already have audio.cpp and the model:

```bash
cd app
npm ci
npm run build
cp ../.env.example ../.env   # then edit AUDIOCPP_CLI, YUE2_MODEL_DIR, YUE2_BACKEND
npm start                    # http://localhost:8000
```

## Configuration

Settings go in `.env` in the repo root (see [`.env.example`](.env.example)). Real environment variables override them.

| Var | Default | |
|---|---|---|
| `AUDIOCPP_CLI` | `engine/bin/audiocpp_cli[.exe]` | engine binary |
| `YUE2_MODEL_DIR` | `models/Yue2-3B-GGUF` | folder with the `.gguf` files and `sidecars/` |
| `YUE2_MODEL_GGUF` | `yue2-3b-q4_0.gguf` | `q8_0` is higher quality and needs more VRAM |
| `YUE2_BACKEND` | `cuda` | `cuda`, `vulkan`, or `cpu`; must match the engine build |
| `CUDA_LIB` | *(none)* | extra CUDA runtime lib dir |
| `PORT` / `HOST` | `8000` / `127.0.0.1` | set `HOST=0.0.0.0` to reach it from your LAN (there's no auth) |
| `YUE2_ROOT` / `YUE2_DB` | repo root / `data/studio.db` | |

## Your data

These folders are created locally and are **not** part of the repo (see `.gitignore`):

- `output/`: generated WAVs, with one `.json` sidecar per song (lyrics, style, seed, metrics)
- `data/studio.db`: favorites, flags, categories, and presets. If you delete it, it's rebuilt from the sidecars on the next start.
- `song-prompts/`: your own prompt files. Any `.md` file in it with a `**Style prompt:**` block becomes a preset.
  See [`song-prompts/examples/`](song-prompts/examples/) for the format.

## Development

```bash
cd app
npm run dev      # http://localhost:5173, hot reload
npm run check    # svelte-check
npm test         # vitest
```

See [`app/README.md`](app/README.md) for architecture notes.

## Credits & licenses

- [audio.cpp](https://github.com/0xShug0/audio.cpp), the inference engine (Apache-2.0)
- [YuE](https://github.com/multimodal-art-projection/YuE) by M-A-P / HKUST, the music model. GGUF weights come from
  [audio-cpp/Yue2-3B-GGUF](https://huggingface.co/audio-cpp/Yue2-3B-GGUF). Check the model card for license and usage terms before using the output commercially.

## License

YuE2 Studio is released under the [MIT License](LICENSE). This covers the app code only, not the
audio.cpp engine or the YuE2 model weights, which have their own licenses (see above).
