# 정식 규약 준수 검토 — `spec/5-system` (--impl-prep)

> 프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system` 18개 파일 중 15개 본문과
> `spec/conventions/**` 거의 전부가 생략되어 있었다. 판정을 위해 생략분을 저장소에서
> 직접 `Read`/`grep` 했다 (`spec/5-system/*.md` 전체, `spec/conventions/error-codes.md` ·
> `swagger.md` · `redis-keys.md` · `migrations.md` · `interaction-type-registry.md` ·
> `spec-impl-evidence.md` 등).

## 발견사항

- **[CRITICAL] `10-graph-rag.md` frontmatter — `pending_plans:` 삽입이 `code:` 증거 경로 3건을 삼켰다**
  - target 위치: `spec/5-system/10-graph-rag.md` 프런트매터 4~24행
    ```yaml
    code:
      ...
      - codebase/backend/migrations/V025__graph_rag.sql
    pending_plans:
      - plan/in-progress/update-returning-tuple-shape.md
      - codebase/backend/migrations/V026__graph_extraction_status_nullable_index.sql
      - codebase/backend/migrations/V027__relation_head_tail_index.sql
      - codebase/backend/migrations/V037__kb_retry_failed_status.sql
    ```
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — `pending_plans` 필드 정의
    ("미구현 surface 를 책임지는 **plan 경로**. `plan/in-progress/` 또는
    `plan/complete/` 에 실존 의무")
  - 상세: `git show 5fbcd20b8 -- spec/5-system/10-graph-rag.md` 로 원인을 특정했다 —
    이 커밋이 `pending_plans:` 키 + 1개 항목(`update-returning-tuple-shape.md`)만 추가하려
    했는데, 삽입 위치가 기존 `code:` 리스트 **중간**이었다. YAML 블록 시퀀스는 새 키
    선언 없이 들여쓰기가 같은 `-` 항목을 계속 이어 붙이므로, 원래 `code:` 소속이었던
    `V026`/`V027`/`V037` 마이그레이션 경로 3개가 그대로 `pending_plans:` 리스트로
    재소속됐다. 본문(§7·96·106행)은 이 세 마이그레이션을 "✅ 구현 완료" 증거로 인용하고
    있어 — 실제로는 `code:` 증거이지 "미구현 plan" 이 아니다.
    빌드 가드 `spec-pending-plan-existence.test.ts` 는 각 경로가
    `plan/in-progress/` 또는 `.../complete/` 로 replace 했을 때 파일이 **존재하기만**
    하면 통과시킨다 — 세 `.sql` 경로가 저장소에 실재하는 파일이라 우연히 존재-검사를
    통과해 CI 가 이 오염을 잡지 못한다(false negative). 문서가 약속한 surface 와
    구현 증거를 추적하는 이 SoT 의 invariant("`pending_plans` 는 plan 문서만 담는다")가
    깨진 채로 main 에 살아 있다.
  - 제안: `pending_plans:` 를 `- plan/in-progress/update-returning-tuple-shape.md`
    한 줄로 되돌리고, `V026`/`V027`/`V037` 세 줄을 `code:` 리스트 끝으로 복귀시킨다.
    (developer 권한 스코프이므로 직접 수정 대신 이 사실을 `--impl-prep` BLOCK 사유로
    전달해 correcting PR 을 유도할 것을 권고.)

- **[WARNING] `status: implemented` 인데 `pending_plans:` 가 비어 있지 않다**
  - target 위치: `spec/5-system/8-embedding-pipeline.md` 11~12행,
    `spec/5-system/10-graph-rag.md` 19~20행 (위 CRITICAL 교정 후에도 남는 1행)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 상태 라이프사이클 표 —
    `implemented` 행의 `pending_plans:` 열 값은 **"없음"**. 같은 문서 §3.1 은 공유
    트래커(`update-returning-tuple-shape.md`)가 여러 문서에 걸릴 때 "그 문서 몫의
    미구현 surface 가 0 이 된 commit" 에서 **"승격하고 `pending_plans` 에서 트래커를
    뺀다"** 고 명시한다(R-11).
  - 상세: `git show 5fbcd20b8` 확인 결과 두 파일 모두 이 커밋에서 `status: implemented`
    를 유지한 채 `pending_plans:` 를 신규 추가했다. `8-embedding-pipeline.md` §7.3.2 는
    이 문서 몫의 결함(CAS 락 미작동)이 `#1168`(2026-08-14)로 **이미 고쳐졌다**고 각주에
    적고 있어, R-11 기준으로는 이 문서 몫이 0 이 된 상태로 보인다 — 그렇다면 트래커를
    `pending_plans` 에서 빼야 한다. 반대로 아직 이 문서에 진짜 남은 몫이 있다면
    `status` 는 `partial` 이어야 한다. 어느 쪽이든 현재 조합(`implemented` +
    비어있지 않은 `pending_plans`)은 §3 표를 직접 위반한다. 빌드 가드
    `spec-status-lifecycle.test.ts` 는 `implemented`/`archived` 상태에 대해
    "lifecycle guard idle" 로 검증을 건너뛰므로 이 조합은 CI 에서 잡히지 않는다.
  - 제안: (a) 이 두 문서 몫이 실제로 끝났다면 `pending_plans:` 를 제거, 또는 (b) 아직
    할 일이 남았다면 `status: partial` 로 낮추고 §3 규약을 그대로 만족시킨다. 어느
    쪽이든 project-planner 턴에서 판단해 정정해야 한다(developer 는 `spec/` write 권한 없음).

- **[WARNING] `4-execution-engine.md` 본문·pending_plans 가 이미 `plan/complete/` 로 이동한 트래커를 "잔여 후속"으로 계속 지목**
  - target 위치: `spec/5-system/4-execution-engine.md` 12행(frontmatter `pending_plans`),
    439·1155행 본문 "잔여 후속: `plan/in-progress/exec-intake-followups.md`"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 정의
    (실제로 미구현인 surface 를 가리켜야 함) 및 §3.1 승격 규칙의 취지
  - 상세: `plan/in-progress/exec-intake-followups.md` 는 이미 `plan/complete/exec-intake-followups.md`
    로 이동했고(`status: complete`, 전 항목 `[x]`), `spec_impact: none` 이다. 이 문서
    자체는 `status: partial` 이라 §3 lifecycle 표를 직접 위반하진 않지만(다른 3개
    pending_plans 가 여전히 열려 있어 `spec-pending-plan-existence`/`-status-lifecycle`
    가드는 통과), frontmatter 경로와 본문 두 곳이 **이미 완료된 트래커**를 "잔여
    후속" 이라고 부르는 것은 §2.1 이 요구하는 "미구현 surface 대응" 의미와 어긋난다.
  - 제안: `exec-intake-followups.md` 몫이 정말 끝났다면 frontmatter/본문 두 곳에서
    제거하고, 아직 이 문서에 남은 몫이 있다면 그 사실을 새 plan 이나 명시적 각주로
    옮긴다.

- **[INFO] `spec/5-system` 내부에서 `## Overview` 섹션 표기가 3갈래로 갈린다**
  - target 위치: `1-auth.md`(54행) · `4-execution-engine.md`(22행) ·
    `6-websocket-protocol.md`(24행) = `## Overview`; `8-embedding-pipeline.md`(21행) ·
    `9-rag-search.md`(19행) · `10-graph-rag.md`(32행) · `12-webhook.md`(21행) ·
    `13-replay-rerun.md`(20행) · `14-external-interaction-api.md`(39행) ·
    `15-chat-channel.md`(37행) · `17-agent-memory.md`(14행) = `## Overview (제품 정의)`;
    `5-expression-language.md` · `7-llm-client.md` · `11-mcp-client.md` = `## 1. 개요`
    (영문 "Overview" 표기 없음); `16-system-status-api.md` 는 번호 붙은 개요 섹션
    자체가 없음.
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §Spec 문서 구조 —
    권장 헤더는 정확히 `## Overview (제품 정의)`.
  - 상세: "3섹션 권장" 이라 강제 사항은 아니고, `## Rationale` 헤더는 15개 파일
    전부 일관되게 사용 중이다(가드 `consistency_orchestrator.py` 의
    `RATIONALE_HEADER_RE` 도 이 헤더에만 의존해 tooling 파손은 없다). 다만 같은
    폴더 안에서 세 갈래 표기가 혼재해 있어, 신규 파일 추가 시 어느 쪽을 따라야
    하는지 판단 기준이 없다.
  - 제안: 규약을 지키려면 `## 1. 개요`/무헤더 4개 파일을 `## Overview (제품 정의)`
    로 통일하거나, 이미 다수인 현재 상태를 인정해 project-planner SKILL 에
    "다중 spec 파일 + `_product-overview.md` 보유 영역은 개별 `N-name.md` 의
    Overview 섹션이 선택"이라고 명문화한다. 최소 비용 조치로는 새로 손대는 파일부터
    통일.

## 요약

`spec/5-system` 18개 파일은 `spec/conventions/`(error-codes·swagger·redis-keys·
migrations·interaction-type-registry 등)에 대한 명명·응답 포맷·에러 코드 규약을
매우 촘촘하게 준수하고 있다 — 표기(UPPER_SNAKE_CASE) 위반, 레거시 페이지네이션
이중 래핑, `Patch` 접두 DTO, redis 키 형태 위반 등 흔한 패턴을 grep 으로 훑었으나
전부 0건이었고, historical-artifact 예외들도 각 문서가 정확한 SoT 로 참조하고
있었다. 다만 `spec-impl-evidence.md` frontmatter 규약(spec/conventions 소속의
정식 규약)에서 실질적 결함을 발견했다 — `10-graph-rag.md` 는 YAML 삽입 실수로
`code:` 증거 경로 3개가 `pending_plans:` 로 잘못 재소속돼 있고, 이 오염은 CI 가드의
존재-검사 허점 때문에 현재 main 에 그대로 살아 있다. 같은 커밋이 `8-embedding-pipeline.md`
에도 `status: implemented` + 비어있지 않은 `pending_plans:` 조합을 남겨
lifecycle 표(§3)를 직접 어긴다. 두 결함 모두 문서 텍스트(§7.3.2/§7 각주)가 "이미
고쳤다"고 명시하고 있어 원인·정정 방향이 명확하다. 그 외에는 `## Overview` 헤더
표기 불일치, 이미 `plan/complete/` 로 이동한 트래커를 여전히 "잔여 후속"으로
지목하는 문구 등 경미한 문서 위생 이슈만 있다.

## 위험도

HIGH
