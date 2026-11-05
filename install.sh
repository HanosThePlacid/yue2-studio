#!/usr/bin/env bash
# YuE2 Studio installer for Linux / WSL2.
#
#   ./install.sh                       # auto: CUDA build if nvcc found, else prebuilt Vulkan/CPU
#   ./install.sh --backend vulkan      # force a backend: cuda | vulkan | cpu
#   ./install.sh --engine-path /path/to/audiocpp_cli --backend cuda   # reuse an existing engine
#   ./install.sh --model q8_0          # q4_0 (default, ~2.5 GB) | q8_0 | bf16
#   ./install.sh --skip-model          # don't download weights (set YUE2_MODEL_DIR in .env yourself)
#
# Safe to re-run: finished downloads and builds are skipped.
set -euo pipefail

ENGINE_VERSION="v0.9.4"
ENGINE_REPO="https://github.com/0xShug0/audio.cpp"
HF_REPO="https://huggingface.co/audio-cpp/Yue2-3B-GGUF/resolve/main"

BACKEND="auto"
ENGINE_PATH=""
MODEL="q4_0"
SKIP_MODEL=0
CUDA_ARCH=""

usage() { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [[ $# -gt 0 ]]; do
	case "$1" in
		--backend) BACKEND="$2"; shift 2 ;;
		--engine-path) ENGINE_PATH="$2"; shift 2 ;;
		--engine-version) ENGINE_VERSION="$2"; shift 2 ;;
		--model) MODEL="$2"; shift 2 ;;
		--skip-model) SKIP_MODEL=1; shift ;;
		--cuda-arch) CUDA_ARCH="$2"; shift 2 ;;
		-h|--help) usage 0 ;;
		*) echo "Unknown option: $1" >&2; usage 1 ;;
	esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$ROOT/engine"
MODEL_DIR="$ROOT/models/Yue2-3B-GGUF"

c_bold=$'\e[1m'; c_red=$'\e[31m'; c_grn=$'\e[32m'; c_yel=$'\e[33m'; c_off=$'\e[0m'
step() { echo; echo "${c_bold}==> $*${c_off}"; }
ok()   { echo "${c_grn}  ok${c_off} $*"; }
warn() { echo "${c_yel}  warning:${c_off} $*"; }
die()  { echo "${c_red}error:${c_off} $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------- prerequisites
step "Checking prerequisites"
have curl || die "curl not found. Install it: sudo apt install curl"
have tar  || die "tar not found."

if ! have node; then
	die "Node.js not found. Install Node 22 LTS, e.g.:
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
  or use nvm: https://github.com/nvm-sh/nvm"
fi
NODE_VER="$(node -p 'process.versions.node')"
node -e '
	const [a,b]=process.versions.node.split(".").map(Number);
	process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>22?0:1)' \
	|| die "Node $NODE_VER is too old. Need 20.19+ or 22.12+."
ok "node $NODE_VER"

if [[ "$BACKEND" == "auto" ]]; then
	if [[ -n "$ENGINE_PATH" ]]; then BACKEND="cuda"
	elif have nvcc || [[ -x /usr/local/cuda/bin/nvcc ]]; then BACKEND="cuda"
	elif have vulkaninfo && vulkaninfo --summary >/dev/null 2>&1; then BACKEND="vulkan"
	else BACKEND="cpu"
	fi
	ok "backend auto-detected: $BACKEND"
fi
case "$BACKEND" in cuda|vulkan|cpu) ;; *) die "--backend must be cuda, vulkan or cpu" ;; esac
[[ "$BACKEND" == "cpu" ]] && warn "CPU backend works but a song can take a very long time. An NVIDIA GPU (CUDA) is strongly recommended."

# ---------------------------------------------------------------- engine
CLI=""
CUDA_LIB_DIR=""
if [[ -n "$ENGINE_PATH" ]]; then
	step "Using existing engine"
	[[ -x "$ENGINE_PATH" ]] || die "$ENGINE_PATH is not an executable"
	CLI="$(cd "$(dirname "$ENGINE_PATH")" && pwd)/$(basename "$ENGINE_PATH")"
	ok "$CLI"

elif [[ "$BACKEND" == "cuda" ]]; then
	step "Building audio.cpp $ENGINE_VERSION with CUDA (YuE2 only; takes a while the first time)"
	for t in git cmake g++ make; do have "$t" || die "$t not found. Install build tools: sudo apt install -y git cmake build-essential"; done
	NVCC="$(command -v nvcc || echo /usr/local/cuda/bin/nvcc)"
	[[ -x "$NVCC" ]] || die "nvcc (CUDA Toolkit) not found. Install the CUDA Toolkit, or re-run with --backend vulkan"
	GCC_MAJOR="$(g++ -dumpversion | cut -d. -f1)"
	(( GCC_MAJOR >= 13 )) || die "GCC $GCC_MAJOR found, audio.cpp needs GCC 13+. On Ubuntu 22.04: sudo apt install g++-13 && export CXX=g++-13 CC=gcc-13"
	export PATH="$(dirname "$NVCC"):$PATH"

	SRC="$ENGINE_DIR/src"
	if [[ ! -d "$SRC/.git" ]]; then
		git clone --depth 1 --branch "$ENGINE_VERSION" "$ENGINE_REPO" "$SRC"
	else
		ok "source already cloned ($SRC)"
	fi
	BUILD_ARGS=(--backend cuda --model-set custom --models yue2 --target audiocpp_cli)
	[[ -n "$CUDA_ARCH" ]] && BUILD_ARGS+=(--cuda-arch "$CUDA_ARCH")
	(cd "$SRC" && scripts/build_linux.sh "${BUILD_ARGS[@]}")
	CLI="$(find "$SRC/build" -type f -name audiocpp_cli -perm -u+x | head -n1)"
	[[ -n "$CLI" ]] || die "build finished but audiocpp_cli was not found under $SRC/build"
	CUDA_LIB_DIR="$(cd "$(dirname "$NVCC")/../lib64" 2>/dev/null && pwd || true)"
	ok "$CLI"

else
	step "Downloading prebuilt audio.cpp $ENGINE_VERSION ($BACKEND)"
	ASSET="audio-${ENGINE_VERSION}-bin-ubuntu-x64-${BACKEND}.tar.gz"
	DL="$ENGINE_DIR/_downloads"
	mkdir -p "$DL" "$ENGINE_DIR/$BACKEND"
	if [[ ! -f "$DL/$ASSET.done" ]]; then
		curl -fL --retry 3 -o "$DL/$ASSET" "$ENGINE_REPO/releases/download/$ENGINE_VERSION/$ASSET"
		tar -xzf "$DL/$ASSET" -C "$ENGINE_DIR/$BACKEND"
		touch "$DL/$ASSET.done"
		rm -f "$DL/$ASSET"
	fi
	CLI="$(find "$ENGINE_DIR/$BACKEND" -type f -name audiocpp_cli | head -n1)"
	[[ -n "$CLI" ]] || die "audiocpp_cli not found in $ASSET"
	chmod +x "$CLI"
	[[ "$BACKEND" == "vulkan" ]] && ! have vulkaninfo && warn "Vulkan loader not detected. You may need: sudo apt install libvulkan1 mesa-vulkan-drivers (or your GPU vendor's driver)"
	ok "$CLI"
fi

if ENGINE_VER="$(LD_LIBRARY_PATH="${CUDA_LIB_DIR}:${LD_LIBRARY_PATH:-}" "$CLI" --version 2>/dev/null)"; then
	ok "engine runs: $(head -n1 <<<"$ENGINE_VER")"
else
	warn "engine did not run '--version' cleanly. Check shared libraries with: ldd \"$CLI\""
fi

# ---------------------------------------------------------------- model
download() { # url dest
	local url="$1" dest="$2" remote local_size
	remote="$(curl -sIL "$url" | tr -d '\r' | awk 'tolower($1)=="content-length:"{n=$2} END{print n}')"
	if [[ -f "$dest" && -n "$remote" ]]; then
		local_size="$(stat -c %s "$dest")"
		if [[ "$local_size" == "$remote" ]]; then ok "$(basename "$dest") (already downloaded)"; return; fi
	fi
	echo "  downloading $(basename "$dest")"
	curl -fL --retry 5 -C - -o "$dest" "$url"
}

if (( SKIP_MODEL )); then
	step "Skipping model download (--skip-model)"
else
	step "Downloading YuE2 weights ($MODEL) to $MODEL_DIR"
	mkdir -p "$MODEL_DIR/sidecars"
	for f in yue2-generation-config.json yue2-model-config.json yue2-qwen.tiktoken yue2-vae-config.json; do
		download "$HF_REPO/sidecars/$f" "$MODEL_DIR/sidecars/$f"
	done
	download "$HF_REPO/yue2-vae-f16.gguf" "$MODEL_DIR/yue2-vae-f16.gguf"
	download "$HF_REPO/yue2-3b-$MODEL.gguf" "$MODEL_DIR/yue2-3b-$MODEL.gguf"
fi

# ---------------------------------------------------------------- app
step "Installing and building the web app"
(cd "$ROOT/app" && npm ci && npm run build)

# ---------------------------------------------------------------- config
step "Writing $ROOT/.env"
if [[ -f "$ROOT/.env" ]]; then
	cp "$ROOT/.env" "$ROOT/.env.bak"
	warn "existing .env saved as .env.bak"
fi
{
	echo "# Written by install.sh on $(date -u +%Y-%m-%d). Real env vars override these."
	echo "AUDIOCPP_CLI=$CLI"
	(( SKIP_MODEL )) && echo "# YUE2_MODEL_DIR=/path/to/Yue2-3B-GGUF" || echo "YUE2_MODEL_DIR=$MODEL_DIR"
	echo "YUE2_MODEL_GGUF=yue2-3b-$MODEL.gguf"
	echo "YUE2_BACKEND=$BACKEND"
	[[ -n "$CUDA_LIB_DIR" ]] && echo "CUDA_LIB=$CUDA_LIB_DIR"
	echo "PORT=8000"
} > "$ROOT/.env"
ok "done"

cat <<EOF

${c_grn}${c_bold}YuE2 Studio is installed.${c_off}

Start it:
  ./start.sh            (or: cd app && npm start)
Then open http://localhost:8000

Development mode with hot reload:
  cd app && npm run dev     # http://localhost:5173
EOF
