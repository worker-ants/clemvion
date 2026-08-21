# Plan 정합성 검토 — `masked-marker-shared-package.md`

## 발견사항

- **[WARNING]** 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 열린 항목을 참조도, 갱신도 안 한다
  - target 위치: 문서 전체 — 특히 서두("PR #1189 의 이월 항목 중 하나")와 `## 작업` 체크리스트
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:373-382` — **"마커 미러 계약 테스트 — backend SoT ↔ frontend 미러를 기계가 대조하게 한다"** (2026-08-17 등재, 아직 `[ ]`)
  - 상세: 이 항목은 target 이 스스로 "PR #1189 의 이월 항목" 이라 서두에서 밝힌 바로 그 배경 항목이다(문구가 거의 동일 — "프런트/백엔드 `MASKED_MARKERS` 크로스런타임 동기화 테스트 부재"). 그 항목 본문이 이미 *"공유 패키지 추출(`packages/`)이 선행돼야 값싸다 — 그래서 별건으로 남긴다"* 고 정확히 이 작업을 예고해 두었다. 그런데 target 문서는 이 트래커 파일/라인을 어디에서도 인용하지 않고, `## 작업` 체크리스트에도 완료 시 그 항목을 닫는(또는 "계약 테스트 대신 추출+캐너리로 대체됐다" 는 근거와 함께 정정하는) 항목이 없다. target 이 실제로 "계약 테스트가 아니라 추출을 택했다" 는 판단은 합리적이지만, 그 판단이 트래커 항목의 원래 목표(기계적 대조)를 **대체**하는 결정이라는 점이 원본 트래커에는 반영되지 않는다.
    같은 plan 세트의 직접 선례인 `plan/in-progress/ws-event-types-extract.md` 는 정확히 같은 성격(백엔드 값/타입 모듈 추출)의 작업에서 `## 다른 plan 과의 관계` 절을 두어 "정본 트래커는 X 이고, 이 작업은 그 문서의 … 항목을 집행한다. 구현 커밋과 같은 턴에 양쪽을 닫는다" 라고 명시했다. target 은 이 패턴을 따르지 않는다.
  - 제안: target 문서에 "다른 plan 과의 관계" 절을 추가해 `spec-sync-external-interaction-api-gaps.md:373` 를 정본 트래커로 명시하고, `## 작업` 체크리스트에 "그 트래커 항목을 [x] 처리(계약 테스트 → 추출+미러 소멸 캐너리로 대체된 근거 기록)" 를 구현 커밋과 같은 턴에 넣는다.

- **[WARNING]** spec 본문의 "SoT 위치" 서술이 추출 후 stale 해지는데 target 자신의 `spec_impact` 대상인데도 작업 목록에 없다
  - target 위치: frontmatter `spec_impact: - spec/5-system/14-external-interaction-api.md` / `## 작업` 체크리스트(해당 항목 부재)
  - 관련 spec/plan: `spec/5-system/14-external-interaction-api.md:1624` — *"마커 집합은 backend `sanitize-error-message.ts` 가 SoT 이고 프런트가 미러한다 — 어긋나면 가드가 조용히 뚫리므로 양쪽을 함께 갱신한다."* (같은 파일 `:1442` 도 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 의 SoT 로 `sanitize-error-message.ts` 를 인용). frontmatter `code:` 목록(`:13`,`:15`)도 `sanitize-error-message.ts`/`masked-markers.ts` 두 파일만 등재하고 `codebase/packages/masked-markers/**` 는 없다.
  - 상세: target 계획대로 backend/frontend 원 파일에 재export shim 을 남기더라도, 실제 정의(SoT)는 `codebase/packages/masked-markers/` 로 이동한다. spec 본문은 "SoT 는 `sanitize-error-message.ts`" 라고 명시적으로 서술하는데, target 완료 후 이 문장은 부정확해진다(그 파일은 이제 re-export 소비처일 뿐). target 의 `spec_impact` 필드가 이 문서를 이미 지정했음에도 `## 작업` 체크리스트에는 이 SoT 서술이나 frontmatter `code:` 갱신 항목이 없다.
    직접 선례(`ws-event-types-extract.md`)가 정확히 이 클래스("이동한 심볼의 정본 위치 서술 stale") 를 후속 항목으로 전수 처리했고, 그 문서는 "한 철자(클래스명)만 훑어 4곳을 놓쳤다" 는 실패까지 기록해 두었다 — 검색을 좁게 하면 놓친다는 경고다.
  - 제안: `## 작업` 에 "`spec/5-system/14-external-interaction-api.md:1624` SoT 서술 갱신 + frontmatter `code:` 에 `codebase/packages/masked-markers/**` 추가" 를 명시적 항목으로 추가한다. CLAUDE.md 상 spec 편집은 planner 트랙이 원칙이지만, `eia-context-schema-followups.md` 선례가 "가드/코드 변경에 동반되는 SoT 표 sync(신규 요구·결정을 담지 않는 정합화)는 developer 가 `--impl-done` 검증과 함께 수행 가능" 이라고 이미 경계를 정해 두었으므로 developer 범위에서 처리 가능하다.

- **[INFO]** "등록 표면 실측 7곳" 의 단일 백스톱 서술이 과장이다
  - target 위치: `## 등록 표면 (실측 7곳 + lockfile)` 서두 — *"하나라도 빠지면 `internal-package-registration.test.ts` 가 잡는다(그게 그 가드의 존재 이유)."*
  - 관련 plan: `plan/in-progress/eia-context-schema-followups.md` 의 "다른 내부 packages harness 배선" 항목(그 가드의 유래·범위 서술) + 실물 `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration{,-guard}.ts`
  - 상세: 실측하면 `internal-package-registration.test.ts` 는 (a) `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` lint/unit/build 3단계 커버리지, (b) `packages-checks.yml` 의 pathspecs/matrix(둘 다 backend `package.json` 의 `@workflow/*` 의존에서 파생, 그리고 이 describe 블록 자체가 "현재 inert — Actions off" 라고 주석돼 있다) 두 가지만 검증한다. 등록 표 7곳 중 Dockerfile 3곳은 이 테스트가 아니라 **각기 다른** 메커니즘이 잡는다 — `codebase/backend/Dockerfile`/`codebase/frontend/Dockerfile` 는 전용 가드 스크립트가 없고 코드 주석상 "누락 시 build 스테이지 docker 검증이 포착"(즉 docker build 를 실제로 돌려야 드러남)이며, `Dockerfile.playwright-e2e` 는 완전히 별개의 `scripts/check-e2e-playwright-config.py`/`test_check_e2e_playwright_config.py` 가 담당한다. 전반적으로 안전망이 비어 있는 것은 아니지만 "그 가드 하나가 7곳 전부를 잡는다" 는 서술은 정확하지 않다 — 리뷰 시 이 문구만 보고 "단위 테스트가 통과했으니 등록이 완전하다" 고 오판하면(도커 빌드를 안 돌려본 채) Dockerfile 누락이 조용히 남을 수 있다.
  - 제안: 문구를 "각 항목은 서로 다른 메커니즘(단위 테스트 2종 + docker build 실패 2종)으로 잡힌다" 로 정정하거나, 최소한 Dockerfile 3곳은 `internal-package-registration.test.ts` 의 범위 밖(별도 백스톱)임을 각주로 남긴다.

## 요약

target 의 핵심 아키텍처 판단(계약 테스트 대신 공유 패키지 추출, WS `MAX_SANITIZE_DEPTH` 는 별개 불변식이라 통합하지 않음)은 실측에 근거가 있고 코드베이스의 현재 상태(`MASKED_MARKERS`/`isMaskedMarker`/깊이 상수 위치, 기존 `@workflow/ai-end-reason` 선례, 등록 가드의 실제 검증 범위)와 정합한다. 다만 이 작업이 대체하려는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`) 의 열린 항목과, target 자신이 지정한 `spec_impact` 대상 문서(`14-external-interaction-api.md`)의 SoT 서술이 완료 후 함께 갱신돼야 하는데 두 곳 다 target 의 작업 목록에 빠져 있다 — 같은 plan 세트의 직접 선례(`ws-event-types-extract.md`)가 정확히 이 두 가지(자매 트래커 동시 갱신, 이동 심볼의 정본 위치 stale 정정)를 명시적으로 수행했던 것과 대비된다. CRITICAL 급의 미해결 결정 충돌은 없다 — 이는 결정 합의가 필요한 사안이 아니라 완료 후 문서 동기화 누락(WARNING) 이다.

## 위험도
MEDIUM
