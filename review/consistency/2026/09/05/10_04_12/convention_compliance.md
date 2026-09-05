# 정식 규약 준수 검토 — `spec/conventions/migrations.md` · `spec/conventions/review-citations.md`

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
실제 델타: `spec/conventions/migrations.md`(§5 절차에 5줄 추가) · `spec/conventions/review-citations.md`(신규 파일, 124줄) + 구현 diff `codebase/backend/migrations/README.md`(54줄, §5 "인덱스 교체는 DROP-먼저" 절 신설).

## 사전 확인 — 이 델타는 직전 두 라운드의 RESOLUTION 그대로다

`git rev-parse HEAD` = `1b6ce5f8a`(= 09_53_09 라운드의 RESOLUTION 커밋)이고, `git log 1b6ce5f8a..HEAD -- spec/conventions/migrations.md spec/conventions/review-citations.md` 는 빈 결과다 — 즉 이번 target 은 `review/consistency/2026/09/05/09_13_39` 와 `.../09_53_09` 두 라운드가 이미 검토·조치한 바로 그 문언이며, 09_53_09 RESOLUTION 이 스스로 밝힌 "이 편집이 stale 리포트를 만드니 한 번 더 돌린다" 는 그 재확인 라운드가 이번 회차다. 아래는 그 조치가 실제로 반영됐는지 재확인 + 신규 관점 스캔이다.

### 직전 라운드 지적의 반영 확인 (전부 해소됨 — 재발 없음)

| 출처 | 지적 | 현재 상태 |
|---|---|---|
| `09_13_39` W1 | README §5 "CREATE 정확히 한 개만" 규정과 3-statement DROP-먼저 패턴의 스코프 미명시 | 반영됨 — README.md:127 "제한 대상은 **`CREATE` 의 개수**입니다 — … `DROP INDEX CONCURRENTLY` 는 이 제한 밖" 문구 확인 |
| `09_13_39` INFO(원인 레이어) | §5 가 혼합 거부를 "PostgreSQL 자체 제약" 이라 적어 실제 1차 거부 주체(Flyway mixed 판정)와 다름 | 반영됨 — README.md 신규 문구가 "**Flyway 의 mixed 판정**에 걸립니다 … 근본 이유는 PostgreSQL 제약 … 거부를 내는 주체는 Flyway 가드" 로 레이어 구분 명시 |
| `09_53_09` W1 | `review-citations.md` §3 이 DTO JSDoc 을 배제 안 해 `swagger.md` §3 과 잠재 충돌 | 반영됨 — §3 표에 `DTO·컨트롤러의 /** */ JSDoc` = 대상 아님 행 + `swagger.md §3` 링크 확인 |
| `09_53_09` INFO#1 | `code:` 의 "준수 예시" 재해석 근거가 `## Rationale` 아닌 곳에 있음 | 반영됨 — `## Rationale`에 `code: 가 "구현 경로"가 아니라 "준수 예시"를 가리키는 이유` 전용 항목 + 기각한 대안 명시 |
| `09_53_09` INFO#2 | `review/**` "사후 편집 대상 아님" 주장의 출처 미인용 | 반영됨 — `plan-lifecycle.md` 링크 + 인용 문장이 `.claude/docs/plan-lifecycle.md:44`("`review/**` 같은 시점 기록 문서는 옛 경로 유지")와 문자 그대로 일치함을 직접 대조 |
| `09_53_09` INFO#3 | §3 표가 `scripts/**`·`.github/**` 를 침묵으로 남김 | 반영(제안보다 강하게) — 각주가 아니라 "적용" 행으로 승격, 실측(8건 중 6건 bare) 근거까지 명시 |

## 발견사항 (신규)

- **[INFO]** README.md 의 내부 cross-reference 가 문서 고유의 "§<번호>" 표기 관례를 벗어남
  - target 위치: `codebase/backend/migrations/README.md:127` — "그 패턴은 아래 **§인덱스 교체**에 있습니다."
  - 위반 규약: 명시적 규약 위반은 아님 — 다만 같은 파일이 다른 모든 곳(`:15 §6`, `:129 §4`, `:189 §4·§5`)에서 예외 없이 **숫자** 섹션 참조(`§4`, `§5`, `§6`)만 쓰는 자기-확립 관례에서 벗어난 유일한 사례.
  - 상세: "인덱스 교체는 DROP-먼저" 는 `### 5. executeInTransaction=false…` 절 **본문 안의 볼드 텍스트**일 뿐 별도 헤딩(`###`)이 아니어서 앵커가 없다. `§인덱스 교체` 라는 이름-기반 참조는 실제 heading slug 와 대응하지 않고, 이 문서에서 유일하게 등장하는 "이름으로 된 §" 표기라 다음 편집자가 검색/링크 대상으로 착각할 여지가 있다. `spec/conventions/migrations.md` 쪽의 대응 인용은 앵커 없이 "README.md §5" 로만 걸어 두어 문제가 없고, 이 지적은 README.md 내부 산문에 한정된다.
  - 제안: `§인덱스 교체` → `아래` 또는 `같은 절(§5) 뒷부분` 처럼 이 문서의 숫자-전용 관례에 맞추거나, 그 패턴에 실제 `#### 인덱스 교체는 DROP-먼저` 급 헤딩을 부여해 이름 참조를 실체화한다. 조치하지 않아도 gate(`spec-link-integrity.test.ts` 는 `spec/**.md` 대상이라 README.md 는 스캔 밖)에 영향 없음 — 순수 가독성 제안.

## 정합성 확인 (위반 아님 — 재검증)

- `review-citations.md` frontmatter(`id: review-citations`/`status: implemented`/`code:` 2파일)는 `spec-impl-evidence.md` §2 스키마·§3 라이프사이클(`implemented` → `code:` ≥1 매치 의무, `pending_plans` 불필요)을 그대로 충족. 두 `code:` 경로(`codebase/backend/src/common/guards/roles.guard.spec.ts`, `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`) 실존 재확인.
- 문서 3섹션 구조(`## Overview (제품 정의)` → 본문 §1~4 → `## Rationale`) 는 `spec-impl-evidence.md`/`user-guide-evidence.md` 와 동일 패턴 유지.
- `migrations.md` 신규 5줄은 기존 번호 체계(`## 5.`)를 건드리지 않고 절차 목록 뒤에 별도 불릿으로 삽입 — 마크다운 렌더링상 순서 리스트/불릿 분리가 올바르며 append-only 원칙(§3)과도 무관(신규 문서 텍스트일 뿐 기존 V파일 수정 아님).
- `spec/conventions/`는 `spec-area-index.test.ts` 에서 flat reference 로 명시 제외돼 있어 신규 파일에 index 갱신 의무 없음 — 미갱신은 위반 아님.

## 요약

이번 target(`migrations.md` 5줄 + 신규 `review-citations.md`)은 `09_13_39`·`09_53_09` 두 라운드가 이미 발견한 WARNING 1건 + INFO 다수를 전부 반영한 상태이며, 재확인 결과 회귀(regression) 없이 그대로 안정적으로 남아 있다. 신규로 발견한 것은 구현 diff(`codebase/backend/migrations/README.md`)의 내부 cross-reference 표기가 문서 자체의 "§<숫자>" 관례에서 한 곳 벗어난 가독성 수준의 INFO 1건뿐이며, `spec/conventions/**` 의 명명·frontmatter·3섹션 구조·API 문서 규약·금지 패턴 중 CRITICAL/WARNING 급 위반은 없다.

## 위험도

LOW
