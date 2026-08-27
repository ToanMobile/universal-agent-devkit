.PHONY: all install test sync help init

all: help

install:
	@echo "Installing agent-kit globally to ~/.local/bin..."
	@mkdir -p $(HOME)/.local/bin
	@ln -sf $(CURDIR)/bin/agent-kit $(HOME)/.local/bin/agent-kit
	@ln -sf $(CURDIR)/bin/install.sh $(HOME)/.local/bin/agent-install
	@echo "✓ Done! You can now run 'agent-kit init' inside any project directory."

init:
	@bash $(CURDIR)/bin/install.sh --domain=auto --mode=symlink $(ARGS)

test:
	@bash $(CURDIR)/bin/agent-kit test

sync:
	@bash $(CURDIR)/bin/agent-kit sync

help:
	@echo "Universal Agent DevKit Makefile"
	@echo ""
	@echo "Targets:"
	@echo "  make install    Install 'agent-kit' globally into ~/.local/bin"
	@echo "  make init       Initialize DevKit for current directory"
	@echo "  make test       Run 294+ regression tests"
	@echo "  make sync       Resynchronize skills & slash commands"
