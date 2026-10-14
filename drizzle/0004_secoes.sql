ALTER TABLE "posts" ADD COLUMN "section" text;--> statement-breakpoint
-- Seções dos posts que já existiam (os importados de content/posts). Só
-- preenche quem ainda não tem seção; slugs que não existirem são ignorados.
UPDATE "posts" SET "section" = 'investigacoes' WHERE "section" IS NULL AND "slug" IN ('h4ck34ndo-as-urnas', 'desmistificando-as-loterias-nacionais', 'desmistificando-artemis');--> statement-breakpoint
UPDATE "posts" SET "section" = 'pesquisas' WHERE "section" IS NULL AND "slug" IN ('el-nino-2026-superguia-do-ciclo-enos', 'ransomware-em-2026-por-que-essa-ameaca-continua-crescendo', 'o-impacto-da-automacao-no-contrato-social');--> statement-breakpoint
UPDATE "posts" SET "section" = 'arquivos' WHERE "section" IS NULL AND "slug" IN ('cicada-3301-o-maior-misterio-da-internet', 'kevin-mitnick-o-hacker-que-enganava-pessoas-nao-maquinas');--> statement-breakpoint
UPDATE "posts" SET "section" = 'reflexoes' WHERE "section" IS NULL AND "slug" IN ('arquitetura-de-software-moderna', 'typescript-patterns-avancados', 'react-server-components-na-pratica', 'o-fim-do-livre-arbitrio');--> statement-breakpoint
UPDATE "posts" SET "section" = 'cultura' WHERE "section" IS NULL AND "slug" IN ('goanime-a-democratizacao-do-entretenimento-via-terminal', 'poesia-quantica');
