# Convention Compliance Review

**대상 문서**: `plan/in-progress/spec-draft-brand-refresh.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 시점**: 2026-05-15

---

## 발견사항

### 정식 규약 준수 위반 없음 (주요 항목 모두 통과)

분석 결과, 아래에 명시된 3건의 INFO 수준 개선 제안을 제외하면 정식 규약과의 직접 위반은 발견되지 않았다.

---

- **[INFO]** plan 문서 자체가 spec 본문을 내포하는 혼합 구조
  - target 위치: 문서 전체 구조 (`## §8 정식 개정안 (drop-in 대체)` 섹션 이하)
  - 위반 규약: `CLAUDE.md` §정보 저장 위치 — "기술 명세(스펙)"은 `spec/<영역>/*.md` 본문에 두도록 규정
  - 상세: 현재 plan 문서는 `plan/in-progress/spec-draft-brand-refresh.md` 이지만, `## §8 정식 개정안` 이하에 실제 spec 본문(§8.1~§8.6, §9, Rationale)을 그대로 내장하고 있다. plan 문서가 아닌 `spec/6-brand.md` 에 들어가야 할 내용이 plan 에 통째로 포함된 형태다. 단, 문서 자체가 "draft — 채택 시 spec 에 drop-in 대체" 임을 명확히 선언하고 있으므로 규약 위반이라기보다 draft 운영 패턴으로 용인 가능한 수준이다.
  - 제안: 현재 구조는 draft 심사·검토 단계이므로 허용 가능하나, `다음 액션` 2번의 "3개 파일 동시 갱신" 이 완료되는 즉시 plan 문서 내 spec 본문 사본이 삭제되거나 `spec/6-brand.md` 로 이동·대체되어야 한다. plan 문서에는 해당 섹션을 "이미 spec 에 반영됨, 상세는 `spec/6-brand.md` §8 참조" 형태로 대체하는 것을 권장한다.

---

- **[INFO]** plan 문서 내 `## Stage 2 인수인계 항목` 섹션 — plan 라이프사이클상 미완 항목 구분 명확화 필요
  - target 위치: `## Stage 2 인수인계 항목` 및 `## 다음 액션` 섹션
  - 위반 규약: `CLAUDE.md` §PLAN 문서 라이프사이클 — "미체크 체크박스, TODO, 남은 작업, 다음 단계 등이 하나라도 있으면 `in-progress/`"
  - 상세: `다음 액션` 1~4번은 numbered list 이며 아직 완료되지 않은 항목들이다. 규약상 `[ ]` 체크박스 형식을 사용해야 complete 판정 자동화(plan_coherence checker)가 가능하다. 현재는 numbered list 로만 표기되어 있어 자동 검출 시 누락될 수 있다.
  - 제안: `다음 액션` 항목들을 `- [ ]` 체크박스 형식으로 변환한다. Stage 2 인수인계 항목(1~7번)도 동일하게 적용하면 Stage 2 진행 상황 추적이 명확해진다.

---

- **[INFO]** `spec/2-navigation/10-auth-flow.md` §1 갱신안에서 로고 참조 앵커 일관성
  - target 위치: `## Stage 1 동기화 대상 / S1-B` 섹션, 신규 안 2번째 bullet
  - 위반 규약: 직접적인 정식 규약 위반은 아니나 `CLAUDE.md` §문서 구조 규약 (단일 진실 원칙)
  - 상세: S1-B 신규안의 두 번째 bullet 에서 `[spec/6-brand.md §8.4.1]` 를 참조하는 앵커가 `(../6-brand.md#841-변종-매트릭스)` 로 작성되어 있다. `#841-변종-매트릭스` 는 한국어 헤딩 `#### 8.4.1 변종 매트릭스` 를 GitHub Markdown 앵커 규칙으로 변환한 값이어야 하는데, GitHub 는 숫자로 시작하는 헤딩을 앵커 생성 시 숫자 prefix를 포함하지 않을 수 있다. 런타임 링크 깨짐 가능성이 있으나 spec 콘텐츠 품질 문제이지 정식 규약 위반은 아니다.
  - 제안: S1-B 를 실제 spec 파일에 반영할 때 앵커를 실제 GitHub Markdown 렌더링 결과로 검증한다. 필요시 앵커 없이 파일 경로만 참조하는 방식(`spec/6-brand.md §8.4.1`)으로 단순화한다.

---

## 금지 항목 점검 결과

| 금지 항목 | 점검 결과 |
| --- | --- |
| 옛 `prd/` 경로 사용 | 미사용. 위반 없음 |
| 옛 `memory/` 경로 사용 | 미사용. 위반 없음 |
| 옛 `user_memo/` 경로 사용 | 미사용. 위반 없음 |
| `plan/*.md` 최상위 생성 | 미해당 (파일은 `plan/in-progress/` 에 위치) |
| `plan/complete/archive/from-*/` 신규 생성 | 미해당 |
| flat 경로 review 생성 (`review/<timestamp>/`) | 미해당 |
| `claude -p` / SDK 직접 호출 | 미해당 (spec draft 문서) |

## 문서 구조 규약 점검 결과

| 항목 | 점검 결과 |
| --- | --- |
| plan frontmatter (worktree, started, owner) | 3필드 모두 존재. 준수 |
| `plan/in-progress/` 위치 | 준수 |
| spec draft 내 `## Rationale` 섹션 | `## Rationale` 섹션 존재 (R-1~R-12). 권장 구조 준수 |
| spec 3섹션 권장 구조 (Overview/본문/Rationale) | draft 내 §8 이 본문 역할, Rationale 별도 섹션. 준수 |
| `spec/conventions/*.md` 참조 형식 | 해당 없음 (brand spec 은 conventions 를 직접 참조하지 않는 영역) |

## API 문서 규약 점검 결과

본 target 문서는 시각 디자인 spec (색상 토큰, 로고 시스템) 으로 API 문서 규약(Swagger 패턴, request/response DTO 명명)의 적용 대상이 아니다. 해당 없음.

## 출력 포맷 규약 점검 결과

본 target 문서는 노드 Output 또는 API 응답 형식을 정의하지 않는다. `spec/conventions/node-output.md` 및 `spec/conventions/cafe24-api-metadata.md` 의 적용 대상이 아니다. 해당 없음.

## 명명 규약 점검 결과

| 항목 | 기댓값 | 실제값 | 결과 |
| --- | --- | --- | --- |
| plan 파일 위치·명명 | `plan/in-progress/<name>.md` (평문) | `plan/in-progress/spec-draft-brand-refresh.md` | 준수 |
| 참조 spec 경로 | `spec/<영역>/N-name.md` | `spec/6-brand.md` | 준수 |
| 참조 layout spec 경로 | `spec/<영역>/_layout.md` | `spec/2-navigation/_layout.md` | 준수 |
| 참조 인증 spec 경로 | `spec/<영역>/N-name.md` | `spec/2-navigation/10-auth-flow.md` | 준수 |
| Stage 2 plan 경로 (예고) | `plan/in-progress/<name>.md` | `plan/in-progress/brand-refresh-impl.md` | 준수 |
| worktree 명명 | `<task_name>-<slug>` (kebab-case) | `brand-refresh-7a3f12` | 준수 |
| logo 자산 경로 | `frontend/public/`, `frontend/src/app/` | §8.4.1 의 9종 경로 모두 해당 경로 준수 | 준수 |

---

## 요약

`plan/in-progress/spec-draft-brand-refresh.md` 는 정식 규약과의 직접적인 충돌 없이 작성되어 있다. frontmatter 의 3필드(worktree, started, owner) 가 모두 채워져 있고, 파일 위치·명명은 CLAUDE.md 규약을 준수한다. 금지된 경로 패턴(`prd/`, `memory/`, `user_memo/`, flat review 경로)은 사용되지 않았으며, 참조하는 spec 파일 경로들도 명명 컨벤션(숫자 prefix, `_layout.md`, `_product-overview.md` 등) 을 따른다. spec 본문과 Rationale 섹션을 plan draft 에 내포하는 구조는 "채택 시 drop-in 대체" 임을 명확히 선언하고 있어 draft 운영 관행으로 용인 가능하다. 발견된 3건은 모두 INFO 수준의 형식 일관성 제안으로, 규약 채택 단계에서의 차단 사유에 해당하지 않는다.

---

## 위험도

**NONE**
