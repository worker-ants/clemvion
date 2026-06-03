# Spec 감사 — root

## 요약

- 감사 파일 수: **3** (`spec/0-overview.md`, `spec/1-data-model.md`, `spec/6-brand.md`)
- severity 분포: none 0 / minor 1 / major 2 / severe 0
- 핵심 메시지:
  - 세 문서 모두 **본체 정확도는 높으나**(아키텍처 다이어그램·엔티티 컬럼·SVG 자산이 코드와 정밀 일치), 일부 핵심 주장이 코드 현실과 정면 충돌한다.
  - 가장 무거운 drift 2건: `0-overview.md` §2.8 의 Flyway **롤백(undo)·환경별 conf** 주장(코드는 forward-only + Docker CLI 인자)과 §6.3 채널 웹채팅 **❌ 미구현 분류**(실제로는 full Next.js 위젯 SPA + SDK 구현됨), 그리고 `1-data-model.md` §2.13 의 **chain_id NOT NULL** 주장(실제 NULLABLE 구현).
  - root cross-cutting 문서 3개 모두 **frontmatter(status/code) 가 전무** — 추적성 확보를 위해 `1-data-model.md`·`6-brand.md` 에 frontmatter 부여 권장.

## 파일별 발견사항

### spec/0-overview.md — major / suggestedStatus: N/A / recommendations: patch-content

**headline**: 아키텍처 개요 본체는 코드와 잘 일치하나, Flyway 롤백(undo)·환경별 conf 주장과 §6.3 채널 웹채팅 ❌ 분류가 stale — 둘 다 코드 현실과 어긋남.

| # | severity | claim | reality | evidence |
| --- | --- | --- | --- | --- |
| 1 | major | §2.8 DB 마이그레이션 롤백 지원 — 각 마이그레이션에 대응하는 undo 스크립트 작성 (`U{version}__{description}.sql`) | undo 스크립트가 하나도 없음. `migrations/README.md` 는 forward-only 명시('이미 적용된 파일은 절대 수정하지 않습니다... 새 마이그레이션 파일을 추가하세요'). `U###` 파일 0개. | `codebase/backend/migrations/` (U*.sql 0건), `codebase/backend/migrations/README.md` |
| 2 | minor | §2.8 환경 분리 — dev/staging/production 환경별 설정 파일 분리 (`flyway-{env}.conf`) | `flyway-*.conf`/`flyway*.conf` 파일이 repo 전체에 존재하지 않음. Flyway 설정은 전용 Docker 이미지(`migrations/Dockerfile`)의 CLI 인자(`-url`/`-user`/`-password`)로 주입. | `codebase/backend/migrations/README.md`, find 결과 `flyway*.conf` 0건 |
| 3 | major | §6.3 로드맵/미구현(❌) — 임베드형 웹채팅 위젯 + SDK '서버는 구현 완료, 클라이언트 레이어 신규(미구현)' | `codebase/channel-web-chat/` 가 full Next.js 위젯 SPA(src 29파일: widget-app, host-bridge, wc-protocol, eia-client, session-store 등). `codebase/packages/web-chat-sdk/` 도 loader/bridge + examples 구현. backend chat-channel 모듈도 어댑터·토큰 로테이터 다수. ❌ 분류는 stale — 최소 partial, 사실상 구현. | `codebase/channel-web-chat/src/widget/widget-app.tsx` 외 28파일, `codebase/packages/web-chat-sdk/src/loader.ts`·`bridge.ts`, `codebase/backend/src/modules/chat-channel/` |
| 4 | minor | §2.7 S3 키 표 — 버킷 이름은 `S3_BUCKET` 환경변수 (기본 `workflow-storage`, `.env.example:55`) | `S3_BUCKET=workflow-storage` 는 맞으나 실제 위치는 `.env.example:102` (스펙은 `:55` 표기). `:55` 부근은 PUBLIC_WEBHOOK rate-limit 주석. | `codebase/backend/.env.example:102` |

**frontmatterIssues**: 본 문서는 frontmatter 없는 루트 cross-cutting 진입 문서로 컨벤션상 정상(status/code/id 없음이 의도된 형태). frontmatter 자체 문제 없음.

**structuralNotes**: 루트 레벨 cross-cutting 진입 문서로 위치·네이밍(`0-` prefix) 모두 컨벤션 부합. §6 구현상태 표(§6.1/6.2/6.3)와 §8 문서 맵, §1~5 아키텍처 다이어그램은 대체로 정확(노드 카테고리·백엔드 모듈·프론트 라우트·큐 이름·exec:recover:lock·KB s3Key·PARALLEL_ENGINE 기본 v1 모두 코드와 일치). 다만 §6.1/§6.3 의 '구현 상태' 축이 채널 웹채팅 진척을 반영하지 못해 latest-only 원칙 위배.

### spec/1-data-model.md — major / suggestedStatus: implemented / recommendations: patch-content, add-frontmatter

**headline**: 엔티티/컬럼 정의는 마이그레이션·엔티티와 대부분 정확히 일치하나, chain_id NOT NULL 주장이 실제 NULLABLE 구현과 정면 충돌하고 frontmatter(status/code) 가 전무함.

| # | severity | claim | reality | evidence |
| --- | --- | --- | --- | --- |
| 1 | major | §2.13 `Execution.chain_id` 는 `UUID \| NOT NULL`. 같은 Re-run chain 의 모든 실행을 묶는 식별자. 원본 실행은 `chain_id = id` 로 자기 참조. | 실제 구현은 chain_id 가 NULLABLE. 일반 실행(원본·sub-workflow·background)은 chain_id=NULL, re-run 으로 생성된 행만 chain_id=<chain root id>. 마이그레이션 헤더가 '안전 변형' 으로 spec §9.1 NOT NULL/자기참조 모델에서 의도적으로 벗어났다고 명시. spec 미갱신. | `migrations/V067__execution_re_run_chain.sql:8-23` (`ADD COLUMN ... chain_id UUID NULL`); `executions/entities/execution.entity.ts:85-86` (`chainId: string \| null`, `nullable: true`) |
| 2 | minor | Rationale 'install_token 형식' / §2.10 — DB 컬럼 `install_token` 은 `String?` 으로 길이 제약 없어 schema 변경 불필요. | 엔티티 install_token 컬럼은 `varchar(64)` 로 길이 제약 있음. 22자 토큰이 들어가 기능상 문제는 없으나 'length 제약 없음' 서술은 부정확. | `integrations/entities/integration.entity.ts:58-64` (`name:'install_token', type:'varchar', length:64`) |
| 3 | minor | §2.6/§3 Node 제약·인덱스는 container/tool_owner CHECK 와 (workflow_id),(container_id),(tool_owner_id) 인덱스. (workflow_id, label) 유일성 언급 없음. | Node 엔티티는 `UQ_node_workflow_label` UNIQUE(workflow_id, label) 선언. 단 이 UNIQUE 제약 생성 마이그레이션 부재(synchronize:false), spec 에도 누락 — 엔티티·spec·마이그레이션 3자 불일치. | `nodes/entities/node.entity.ts:27-28`; migrations grep label UNIQUE 생성 부재; `app.module.ts:177 synchronize:false` |
| 4 | minor | §2.6 Node.category Enum = logic/flow/ai/integration/data/presentation (6개). | 실제 node_category enum 및 NodeCategory 는 'trigger' 포함(7개) — V003 추가. §2.6 본문이 같은 절에서 '트리거 카테고리 노드' 를 전제하면서 enum 열거에는 trigger 누락. | `migrations/V003__add_trigger_category.sql:3`; `nodes/entities/node.entity.ts:15-23 (TRIGGER='trigger')` |

**frontmatterIssues**:
- frontmatter 자체가 전무 — status/code/id 키가 하나도 없음. 마이그레이션·엔티티 전반을 cross-cutting 으로 매핑하므로 최소한 `status: implemented` 와 code 글로브(`codebase/backend/src/modules/**/entities/*.entity.ts`, `codebase/backend/migrations/V*.sql`)를 부여해 추적성 확보 필요.
- code 글로브 검증 불가 — code 키 부재로 가리키는 구현 파일 집합 미정의. 실제 대응 코드는 23개 `*.entity.ts` 와 V001~V068 마이그레이션.

**structuralNotes**: 파일명·위치(root `1-` prefix, cross-cutting 데이터 모델)는 컨벤션 부합. 분류/연번 문제 없음. 대형 단일 문서(774줄)로 frontmatter 부재가 유일한 구조적 결함. 본문 §번호 체계(2.x.y)는 일관적이고 상호 링크 잘 유지.

### spec/6-brand.md — minor / suggestedStatus: implemented / recommendations: add-frontmatter, patch-content, keep

**headline**: 브랜드 spec 의 SVG 자산·gradient·워드마크·Logo 컴포넌트는 코드와 정밀 일치. PNG/.ico 정식경로는 미존재이나 §8.6 follow-up 으로 명시됨. 잔여는 stale 코드 주석·plan 참조 등 사소 항목.

| # | severity | claim | reality | evidence |
| --- | --- | --- | --- | --- |
| 1 | minor | §8.4.1 변종 매트릭스 — Favicon multi 정식 경로 = `src/app/favicon.ico` (16/32/48 합성) | favicon.ico 파일 없음. 실제 자산은 `public/favicon-16.svg` (16px 단일), layout.tsx metadata 가 이를 참조. .ico 합성본 미생성. | `public/favicon-16.svg` 존재 / `src/app/favicon.ico` 부재; `layout.tsx icons.icon` |
| 2 | minor | §8.4.1 — apple-icon.png(180x180), opengraph-image.png(1200x630) 를 정식 경로로 명시 | PNG 미존재. 실제로는 `apple-icon.svg`/`opengraph-image.svg` (public/) 만 존재하고 metadata 도 SVG 참조. spec 자체가 §8.4.1·§8.6 에서 '현재 임시 SVG' 명시해 코드와 모순 아님. | `public/{apple-icon,opengraph-image}.svg` 존재, .png 부재; `layout.tsx icons.apple=/apple-icon.svg` |
| 3 | minor | §8.3/§8.4.3 — tagline 'Agentic Workflow' 는 풀로고 SVG 시각 영역에 미포함, alt/aria-label/메타 description 에만 노출 | Logo 컴포넌트 주석(`logo.tsx:14-15`)이 full variant 를 'icon mark + wordmark + AGENTIC WORKFLOW sub-copy' 로 기술해 spec 과 반대. 실제 logo.svg 에는 sub-copy 없고 DEFAULT_ALT 만 tagline 보유 — 동작은 spec 준수, 주석만 stale. | `components/ui/logo.tsx:14, :50`; `public/logo.svg` (텍스트=Clemvion 단독) |
| 4 | minor | §8.4.5 여백·최소 크기 — 최소 풀로고 너비 160px, 그 이하에서는 icon-only/wordmark-only 로 전환 | 사이드바 expanded 가 `<Logo variant="full" size={150}>` 로 풀로고를 160px 미만(150px)에 렌더링. spec 의 전환 임계 규정과 직접 충돌. | `components/layout/sidebar.tsx:404` |
| 5 | minor | §8.1/§8.4.3 — OG 카드 시각은 mark+wordmark 2요소, tagline 은 시각 영역 밖 | opengraph-image.svg 하단에 가시 텍스트 'AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템'(§6 one-line definition) 노출. 'Agentic Workflow' tagline 은 아니지만 풀로고 외 추가 카피가 OG 시각에 박혀 §8.4.3 의 '풀로고=2요소' 원칙과 미세 불일치. | `public/opengraph-image.svg` (하단 `<text>`) |
| 6 | minor | (Rationale) Tailwind v4 dark variant 가 .dark ancestor class 추적하도록 globals.css 에 `@custom-variant dark` 선언 | 일치. `@custom-variant dark (&:where(.dark, .dark *));` 존재. | `globals.css:23` |
| 7 | minor | Mark gradient #12acaa→#8be67e, userSpaceOnUse 좌표 (69.856,105.446)→(30.467,58.503), viewBox 320x80, 워드마크 weight500/size48/letter-spacing-1/fill #000(light)#fff(dark), Helvetica Neue stack | 모든 SVG 자산에서 gradient stop·좌표·viewBox·워드마크 font 속성·fill 이 spec 과 정확히 일치. | `public/logo.svg, logo-dark.svg, logo-mark.svg, logo-wordmark*.svg`; `src/app/icon.svg` |

**frontmatterIssues**:
- frontmatter 자체가 없음(status/code/id 미선언). root cross-cutting 브랜드 문서지만 구현 코드(`public/*.svg`, `src/app/{icon,layout}`, `components/ui/logo.tsx`)가 명확히 존재하므로 `code:` 글로브 + `status: implemented` frontmatter 추가 권장.
- layout.tsx 가 `plan/in-progress/brand-refresh-impl.md` 를 follow-up 추적 근거로 참조하나 해당 plan 파일이 in-progress·complete 어디에도 없음(stale 참조). spec §8.6 follow-up 추적처가 코드 주석에만 있고 plan 으로 미연결.

**structuralNotes**: 파일명 `6-brand.md` 는 root cross-cutting 문서로 `0-overview`/`1-data-model` 과 같은 N-name.md 컨벤션 부합 — 적절. 단 §8.4.1 매트릭스가 'png/.ico 정식경로' 와 'svg 임시자산' 을 한 표 정식경로 칸에 png/.ico 로만 적고 비고로 임시 SVG 를 보충하는 구조라, 자산 경로를 코드와 1:1 대조하려는 독자가 png/.ico 부재를 drift 로 오인하기 쉬움. 정식경로 칸을 현 실제 자산(svg)으로 바꾸고 png/.ico 를 follow-up 목표로 분리 기재하면 정합성 명료해짐.

## 영역 구조·네이밍 이슈

- root 영역 3문서 모두 `N-name.md` (0-overview, 1-data-model, 6-brand) 컨벤션을 일관 준수 — 위치·연번·분류 문제 없음.
- **frontmatter 정규화 비대칭**: `0-overview.md` 는 진입 문서로 frontmatter 없음이 의도된 정상이나, `1-data-model.md`·`6-brand.md` 는 명확한 대응 구현 코드가 있음에도 frontmatter 가 전무하다. 두 문서에 `status` + `code:` 글로브를 부여해 cross-cutting 추적성을 확보하는 것이 영역 전반의 정규화 우선순위.
- §6.x 구현상태 표(0-overview)의 '구현 상태' 축이 latest-only 원칙을 위배(채널 웹채팅 ❌ 가 stale) — 구현 진척이 빠른 영역은 정기 동기화 필요.

## 우선 액션 (정렬)

### major

1. `spec/0-overview.md` §6.1/§6.3 — 채널 웹채팅 위젯+SDK 분류를 ❌ 에서 구현(✅/partial)으로 갱신. 근거: `codebase/channel-web-chat/` (29파일), `codebase/packages/web-chat-sdk/`, `codebase/backend/src/modules/chat-channel/`.
2. `spec/0-overview.md` §2.8 — DB 마이그레이션 '롤백(undo) 스크립트' 주장을 forward-only 정책으로 정정. 근거: `codebase/backend/migrations/README.md` (U*.sql 0건).
3. `spec/1-data-model.md` §2.13 — `Execution.chain_id` 를 NOT NULL/자기참조 → NULLABLE(re-run 행만 set)로 정정. 근거: `migrations/V067__execution_re_run_chain.sql:8-23`, `executions/entities/execution.entity.ts:85-86`.

### minor

4. `spec/0-overview.md` §2.8 — 환경별 `flyway-{env}.conf` 분리 서술을 Docker 이미지 + CLI 인자 방식으로 정정. 근거: `migrations/README.md`.
5. `spec/0-overview.md` §2.7 — S3_BUCKET 위치 `.env.example:55` → `:102` 로 정정.
6. `spec/1-data-model.md` — frontmatter 추가(`status: implemented`, `code:` 글로브 = `codebase/backend/src/modules/**/entities/*.entity.ts`, `codebase/backend/migrations/V*.sql`).
7. `spec/1-data-model.md` §2.10/Rationale — install_token 'length 제약 없음' → `varchar(64)` 로 정정. 근거: `integrations/entities/integration.entity.ts:58-64`.
8. `spec/1-data-model.md` §2.6 — Node.category enum 열거에 `trigger` 추가(7개). 근거: `V003__add_trigger_category.sql`, `node.entity.ts:15-23`.
9. `spec/1-data-model.md` §2.6/§3 — Node `UQ_node_workflow_label` UNIQUE(workflow_id, label) 명시. 엔티티 선언만 있고 마이그레이션 부재이므로 마이그레이션 생성 여부도 함께 결정. 근거: `node.entity.ts:27-28`.
10. `spec/6-brand.md` — frontmatter 추가(`status: implemented`, `code:` 글로브). §8.4.1 정식경로 칸을 실제 SVG 자산으로 정정하고 png/.ico 를 follow-up 으로 분리. sidebar.tsx:404 의 size=150 (160px 임계 위배)도 코드/spec 중 하나로 정합화.
11. `spec/6-brand.md` 관련 코드 정리(spec 외): `logo.tsx:14-15` stale 주석 수정, `plan/in-progress/brand-refresh-impl.md` stale 참조 해소.
