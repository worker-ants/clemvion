# 문서화(Documentation) 리뷰 — dto-class-jsdoc-citation

## 발견사항

- **[INFO]** 트래커 항목 미종결 (예상된 상태, 결함 아님)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1277` (`- [ ] **`Ref` DTO **클래스** JSDoc 두 곳에 리뷰 인용이 남아 있다**`)
  - 상세: 이 PR 이 닫아야 할 선행 트래커 체크박스가 아직 `[ ]` 다. 다만 이번 PR 의 자체 plan(`plan/in-progress/dto-class-jsdoc-citation.md`) 체크리스트에도 "트래커 항목 닫기 · planner draft 이동" 이 `[ ]` 로 명시돼 있고, `plan/in-progress/spec-draft-review-citations-class-jsdoc.md` "구현 위임" 절에 "완료 후 트래커 항목 … 을 닫고 이 결정을 참조로 남긴다" 는 위임 문구가 이미 있다. 즉 이 세션 관례(마무리 커밋에서 체크박스+`complete/` 이동을 함께)를 따르는 정상 진행 상태다.
  - 제안: `/ai-review` · `--impl-done` 이후 마무리 커밋에서 트래커 체크박스를 닫고 두 plan 파일을 `plan/complete/` 로 이동할 것 — 이미 계획돼 있으므로 별도 조치 불요.

## 검증한 항목 (문제 없음)

- **DTO 클래스 JSDoc 두 곳** (`codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`, `.../triggers/dto/responses/trigger-response.dto.ts`): 리뷰 인용이 JSDoc(`/** */`)에서 바로 위 `//` 블록으로 정확히 옮겨졌고, JSDoc 본문(자매 타입과의 차이·"갈아 끼우지 말 것")은 그대로 보존됨. 실제 파일을 읽어 확인.
- **가드 코드 주석 정확성** (`codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`, `dto-jsdoc-citation.spec.ts`): 종전에 "클래스 JSDoc 도 스키마 description 으로 나간다" 는 틀린 근거가 두 파일에 있었는데, 이번 PR 이 필드/클래스를 갈라 정확한 근거(빌드 산출물 실측 — 프로퍼티 메타데이터만 생성됨)로 바로잡음. `grep` 으로 옛 문구("둘 다 OpenAPI 로 나간다", "클래스는 스키마 description") 잔존 여부 확인 — 0건.
- **`EXPECTED_DTO_JSDOC_CITATIONS` 래칫 docstring**: "베이스라인이 0이 아니다" → "베이스라인은 0 이다 (2026-09-27)" 로 갱신되어 상수 값(`[]`)과 문서가 일치.
- **CHANGELOG** (`CHANGELOG.md` `## Unreleased — 저장소 가드: …`): 가드 동결 목록이 비어 예외가 없어졌다는 "개발 흐름이 바뀐다" 류 변경을 정확히 서술. 실제 diff(가드 목록 `[]`, 두 DTO 편집)와 문구가 일치함.
- **spec 본문** (`spec/conventions/review-citations.md` §3 표 + 신설 Rationale 절, `spec/conventions/swagger.md` §3): DTO 행을 필드/클래스로 정확히 분리했고, 신설 Rationale 은 (A)/(B) 두 대안과 기각 근거를 실측(2026-09-27 `codebase/backend/dist`)과 함께 적음. 표의 `[Rationale](#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27)` 앵커를 GitHub 슬러그 규칙(소문자화·`§`/em-dash/괄호 제거·공백→하이픈)으로 직접 재계산해 실제 헤딩 `### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)` 과 정확히 일치함을 확인 — 깨진 링크 아님. `swagger.md` §3 도 짝 규약으로 동기화됨(선행 consistency 라운드 WARNING#1 이 지적한 갭이 최종 diff에서 이미 해소돼 있음).
- **plan 문서** (`plan/in-progress/dto-class-jsdoc-citation.md`, `plan/in-progress/spec-draft-review-citations-class-jsdoc.md`): 실측·방향·뮤턴트 표·체크리스트·Rationale 모두 실제 코드 변경과 부합. 선행 consistency 체크(`review/consistency/2026/09/27/08_41_33`)가 지적한 WARNING 3건(swagger.md 미동기화·draft 고유 Rationale 부재·트래커 위임 누락) 모두 최종본에서 해소됨(각각 spec_impact 확장, `## Rationale (draft)` 절 추가, "구현 위임" 절의 트래커 종결 문구 추가로 확인).
- **상대 링크 사고 후속 조치**: plan 체크리스트가 기록한 "frontend plan-frontmatter.test.ts 가 깨진 상대 링크 3건을 잡음" 사고 이후 커밋(`1f5c4273f`)에서 실제로 `plan/in-progress/spec-draft-review-citations-class-jsdoc.md` 의 링크가 `../../spec/conventions/swagger.md` 등 plan 디렉터리 기준 경로로 고쳐졌음을 파일 직접 열람으로 확인.
- **README/API 문서/설정 문서/예제 코드**: 해당 없음 — 이 변경은 OpenAPI 산출물·환경변수·공개 API 계약을 바꾸지 않는 내부 가드·주석·규약 정리이며, plan 자체도 "OpenAPI 산출물을 바꾸지 않는다" 를 실측으로 명시함.

## 요약

응답 DTO 클래스 JSDoc 두 곳의 리뷰 인용을 `//` 주석으로 옮기고 가드의 동결 예외 목록을 비운 변경으로, 코드 주석·가드 docstring·CHANGELOG·spec(`review-citations.md` §3, `swagger.md` §3)·plan 문서가 서로 정확히 대응한다. 특히 종전에 두 곳에 남아 있던 "클래스 JSDoc 도 OpenAPI 로 나간다" 는 틀린 근거를 빌드 산출물 실측으로 정정하고 그 정정을 모든 관련 문서(가드 코드 주석 2곳·spec 본문 2곳·plan Rationale)에 일관되게 반영한 점이 눈에 띈다. 앵커 링크·상대 경로·트래커 위임 등 세부 사항까지 실제 파일을 열람해 대조했으나 결함을 찾지 못했다. 유일한 관찰 사항(선행 트래커 체크박스 미종결)은 이 PR 자신의 계획된 마무리 커밋 단계에 속하며 문서화 결함이 아니다.

## 위험도

NONE
