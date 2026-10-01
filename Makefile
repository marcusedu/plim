PREFIX ?= $(HOME)/.local
BINDIR ?= $(PREFIX)/bin

.PHONY: all install link uninstall test test-cli test-mcp test-worker

all:
	@echo "Comandos disponíveis:"
	@echo "  make link       - Cria link simbólico em $(BINDIR)/plim (recomendado para desenvolvimento)"
	@echo "  make install    - Copia o binário para $(BINDIR)/plim"
	@echo "  make uninstall  - Remove o binário de $(BINDIR)/plim"
	@echo "  make test       - Executa todos os testes automatizados (CLI, MCP e Worker)"

install:
	@mkdir -p $(BINDIR)
	cp bin/plim $(BINDIR)/plim
	chmod +x $(BINDIR)/plim
	@echo "plim copiado para $(BINDIR)/plim"

link:
	@mkdir -p $(BINDIR)
	ln -sf $(CURDIR)/bin/plim $(BINDIR)/plim
	chmod +x $(BINDIR)/plim
	@echo "Link simbólico criado em $(BINDIR)/plim -> $(CURDIR)/bin/plim"

uninstall:
	rm -f $(BINDIR)/plim
	@echo "plim removido de $(BINDIR)/plim"

test: test-cli test-mcp test-worker
	@echo "\n🎉 Todos os testes passaram com sucesso!"

test-cli:
	@./tests/test_cli.sh

test-mcp:
	@node tests/test_mcp.js

test-worker:
	@cd worker && npx tsc --noEmit
	@echo "  ✅ PASS: Worker TypeScript tipagem válida"
