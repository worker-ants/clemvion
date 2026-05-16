# 변경 범위(Scope) 리뷰 — 최근 50 커밋 (main bbd838ef 기준)

## 발견사항

- **[WARNING]** B-3-7 cursor 제거 후 spec/4-nodes/4-integration/4-cafe24.md 미갱신
  - 위치: `967425eb` / `spec/4-nodes/4-integration/4-cafe24.md` lines 23, 90
  - 상세: `cafe24.schema.ts` 와 `cafe24.handler.ts` 에서 `cursor` 필드를 제거하고 코드에 "spec/4-nodes/4-integration/4-cafe24.md §3.3 (pagination) 참조" 주석을 달았으나, 해당 spec 의 §3 Input 표 (`{ limit?: number, offset?: number, cursor?: string }`, line 23) 와 §4.2 Query 구성 단계 (`pagination.{limit, offset, cursor}` 는 항상 query, line 90) 에는 cursor 가 그대로 남아 있다. 코드와 spec 이 불일치 — CLAUDE.md MEMORY "Plan must include spec updates" 규약 위반.
  - 제안: `spec/4-nodes/4-integration/4-cafe24.md` §3 Input 표와 §4.2 Query 구성 단계에서 `cursor` 필드 언급을 제거하고, B-3-7 결정 근거("Cafe24 Admin API 는 limit/offset 만 지원")를 Rationale 에 명문화한다.

- **[WARNING]** test(cafe24) 커밋(d6baf89a)에 런타임 프로덕션 코드 변경 혼입
  - 위치: `d6baf89a` / `backend/src/nodes/integration/_base/integration-handler-base.ts`
  - 상세: 커밋 제목이 `test(cafe24): 테스트 Medium 묶음 + logUsage swallow` 이고 followup-backlog B-5 항목으로 분류되어 있으나, `integration-handler-base.ts` 의 `logUsage()` 를 try/catch 로 감싸는 프로덕션 런타임 동작 변경(B-5-6)이 포함되었다. 이는 테스트 추가가 아니라 동작 변경이므로 별도 fix 커밋 또는 fix 접두사 분리가 맞다. 범위 혼합으로 커밋 의미가 흐려지고 롤백/bisect 시 테스트와 런타임 변경을 분리할 수 없다.
  - 제안: `logUsage` try/catch 변경(B-5-6)과 테스트 케이스 추가(B-5-1/B-5-3/B-5-5/B-5-7)를 별도 커밋으로 분리. 동일 backlog 항목 안이더라도 `fix:` 와 `test:` 성격의 변경은 원자성을 위해 분리하는 것이 좋다.

- **[WARNING]** refactor 커밋(eacbd45e)에 review/_prompts 대규모 파일 혼입
  - 위치: `eacbd45e` / `review/code/2026/05/16/16_26_10/_prompts/*.md` (13개, +2928~2930줄씩) + `review/code/2026/05/16/16_39_38/_prompts/*.md` (13개, +3949~3951줄씩)
  - 상세: `refactor(integrations): cafe24 mall-dup-ux follow-up — W20·W21·W23·INFO6` 커밋에 실제 코드 변경(8개 파일, +228/-81) 과 함께 두 review 세션의 _prompts 파일 26개와 RESOLUTION/SUMMARY, 각 reviewer 산출물이 한꺼번에 포함되었다. 코드 변경 커밋과 review 아카이브 커밋의 경계가 없어 코드 히스토리 파악이 어렵다. 마찬가지로 `bb038f90` 에도 코드 5파일 변경과 review 세션 26개 파일이 혼재한다.
  - 제안: review 산출물(세션 _prompts, SUMMARY, RESOLUTION, reviewer 별 review.md)은 별도 `chore(review):` 커밋으로 분리한다. 코드 변경과 review 아카이브는 서로 다른 라이프사이클을 가지므로 혼합하면 코드 diff 추적이 방해된다.

- **[INFO]** B-2-1 `pg-error.ts` 공통 헬퍼 신설 — 범위 준수, 스펙 미언급
  - 위치: `4a75e77b` / `backend/src/common/db/pg-error.ts`
  - 상세: PostgreSQL 에러 코드 추출 헬퍼를 `backend/src/common/db/` 아래 신설한 것은 B-2-1 의 중복 패턴 통일 의도에 부합하는 적절한 범위 확장이다. 단, 공통 인프라 헬퍼 신설인 만큼 spec 또는 conventions 에 패턴 언급이 없어 향후 중복 구현이 발생할 수 있다.
  - 제안: `spec/conventions/` 에 PostgreSQL 에러 처리 헬퍼 사용 규약을 한 줄이라도 추가하면 다른 모듈에서의 중복 inline 패턴을 방지할 수 있다.

- **[INFO]** Phase 8 (g/h/i/j) feat 커밋들 — 범위 적절, spec 동시 갱신 확인됨
  - 위치: `3bf6bb22`, `676a289d`, `f6f610b1`, `13036e0d`
  - 상세: Application/Collection/Design/Community 메타데이터 신설 커밋들이 각각 `spec/conventions/cafe24-api-catalog/*.md` 와 `_overview.md` 를 함께 갱신하고 있어 CLAUDE.md MEMORY "Plan must include spec updates" 규약을 준수했다.
  - 제안: 없음.

- **[INFO]** chore(plan) 커밋 15건 — plan/complete 이동 시 살아있는 spec 링크 갱신 여부 미확인
  - 위치: `d503b447` / `plan/in-progress/cafe24-followup-backlog.md` 등
  - 상세: plan 문서 15건을 `complete/` 로 이동하면서 CLAUDE.md "이동과 동시에 갱신한다" 지침에 따라 spec 의 plan 링크도 갱신해야 한다. 단, spec 내 plan 파일 직접 링크 여부는 이번 리뷰에서 확인 범위를 벗어나며, 이동 자체는 git mv 로 수행되어 히스토리는 보존되었다.
  - 제안: 향후 plan 이동 시 spec 본문에 plan 경로를 직접 참조하는 링크가 있다면 함께 갱신하는 체크리스트 항목을 추가한다.

- **[INFO]** B-1-3 (timestamp replay) — 보안 fix가 spec 갱신 후 구현으로 2-commit 분리 처리
  - 위치: `b8dc94e7` (spec에 잔여 위험 명문화) → `82dd420a` (Redis nonce cache 구현 + spec 갱신)
  - 상세: B-1-3의 처리가 두 커밋에 걸쳐 분리된 것은 백로그 계획과 일치한다. 각 커밋에서 spec이 함께 갱신되어 단일 진실 원칙이 유지되었다. 범위 scope 관점에서 적절하다.
  - 제안: 없음.

---

## 요약

최근 50 커밋은 cafe24 followup-backlog(B-1 ~ B-5-8), A-1 알림 신설, Phase 8 메타데이터 완성이라는 명확한 작업 단위 안에서 진행되었으며, 전반적으로 scope creep 없이 plan 항목과 1:1 대응이 잘 유지되었다. 가장 주목할 문제는 B-3-7 cursor 제거 시 `spec/4-nodes/4-integration/4-cafe24.md` 의 pagination 정의가 갱신되지 않아 코드와 spec 간 불일치가 남아 있는 점이다(WARNING). 또한 `test(cafe24)` 커밋에 프로덕션 런타임 동작 변경(`logUsage` try/catch)이 혼입된 것과, refactor/fix 커밋에 대규모 review 아카이브 파일이 함께 포함된 것은 커밋 원자성과 히스토리 가독성 측면에서 개선이 필요한 패턴이다. 보안 관련 변경(B-1 ~ B-1-3)은 spec 갱신을 수반했고, 마이그레이션(B-4-1/B-4-4)도 `executeInTransaction=false` + `CONCURRENTLY` 옵션을 갖춘 안전한 형태로 처리되어 범위 밖 위험은 감지되지 않았다.

---

## 위험도

LOW
