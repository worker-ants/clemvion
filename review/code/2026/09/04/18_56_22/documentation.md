# 문서화(Documentation) 리뷰

## 리뷰 범위

이번 diff 는 `QueryExecutionDto.workflowId` 죽은 쿼리 파라미터 제거(문서화 관련 실질 변경)와,
그 변경을 다룬 **직전 리뷰 라운드(`18_34_04`)·consistency 라운드(`18_51_26`)의 산출물을
저장소에 영구 보존**하는 커밋으로 구성된다.

- `CHANGELOG.md` — 신규 `## Unreleased` 항목
- `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `forbidNonWhitelisted` 축 테스트 + JSDoc 성격의 블록 주석 신설 (직전 라운드 W2 조치)
- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — 필드 제거 + 클래스 JSDoc 신설
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `@Transform` 예외 rationale JSDoc 갱신(실사례 0건 반영)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 체크박스 종결 + 트래커 표 동기화 + "개수 하드코딩 금지" 구조 개선 (직전 라운드 W3 조치)
- `review/code/2026/09/04/18_34_04/*`, `review/consistency/2026/09/04/18_51_26/*` — 프로젝트 관례(`CLAUDE.md` "정보 저장 위치")대로 `review/code/**`·`review/consistency/**` 에 영구 보존되는 산출물

## 검증 절차

- `spec/2-navigation/14-execution-history.md:345` 를 직접 열어 JSDoc·CHANGELOG 가 인용한
  "페이지네이션, 상태 필터, 정렬" 문구가 실제로 그 줄에 있음을 확인 — 인용 정확.
- `swagger-dto-contract-guard.ts:92-121` 전체를 읽어 갱신된 JSDoc 블록이 문법·문맥상
  자연스럽게 이어짐을 확인. 참조하는 `swagger-dto-contract.spec.ts` 의
  `[대조군] @Transform 예외` 픽스처가 실제로 존재함을 `grep` 으로 확인
  (`swagger-dto-contract.spec.ts:173`).
- `CHANGELOG.md` 상단 기존 항목들과 신규 항목의 구조(표 · **영향** 절 · 실측 근거)를
  대조 — 기존 관례와 일관됨. PR 번호를 본문에 박지 않는 것도 기존 항목들(예: `invitedBy`
  항목)과 동일한 관례.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `## 후속` 체크박스
  미체크 수(2) 와 `## 종결 조건` 표의 열린 행 수(2) 가 일치함을 직접 세어 확인 — 두 군데
  동기화가 실제로 이뤄졌다.
- `review/code/2026/09/04/18_34_04/documentation.md`(직전 라운드의 문서화 리뷰 산출물)를
  열람 — 동일한 관점을 이미 NONE 판정했고, 이번 diff 의 추가 조치(테스트 신설, plan 개수
  하드코딩 제거)는 그 라운드 W2/W3 지적에 정확히 대응한다.

## 발견사항

- **[INFO]** §③ 스냅샷 표의 모집단(1,096)이 이번 diff 로 실제 값(1,095)과 어긋난다 — 단, 이번 diff 범위 밖이고 문서 자신이 이미 시점 고정을 원칙으로 명시
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` §③ ("**기준** (2026-09-04, AST 재측정)... 필드 선언 **1,096개** 모집단") — 이 섹션은 이번 diff 가 건드리지 않음(변경분 없음, 게이트 없음)
  - 상세: 이번 diff 가 제거한 `workflowId` 필드는 `@ApiPropertyOptional` 을 달고 있었으므로 §③ 이 AST 로 집계한 "1,096개" 모집단에 포함돼 있었을 것이다. 제거 후 실제 모집단은 1,095 인데(같은 문서의 `## 후속` 항목·CHANGELOG·가드 JSDoc 이 공유하는 수치), §③ 은 여전히 1,096 을 표기한다. 다만 §③ 은 이미 "이 표는 계약 거짓 9곳 수정 적용 *전* 스냅샷" 이라는 캐비엇과 "날짜를 박아 둔 실측이 같은 PR 안에서 낡았다. 정량 기록은 '잰 시점'의 값" 이라는 일반 원칙을 명시적으로 달아 두고 있어, 이번 추가 드리프트도 그 원칙의 연장선으로 볼 수 있다. 직전 리뷰 라운드(`18_34_04`)의 문서화 리뷰도 이 자리를 검토했고 "의도된 시점 고정" 으로 판단했다.
  - 제안: 조치 불요(원칙적으로 이미 수용된 드리프트). 다만 §③ 자체를 다음에 손댈 때는 "9곳 수정 적용 전/후" 캐비엇 옆에 "이후 `workflowId` 제거로 모집단이 1,095 로 줄었다" 한 줄을 추가하면, "정량 기록은 잰 시점의 값" 이라는 원칙을 몰라도 되는 최신 독자에게 더 친절하다.

- **[INFO]** review 산출물 신규 파일 20개는 그 자체로는 개발자 문서화 관점의 결함이 없음
  - 위치: `review/code/2026/09/04/18_34_04/*`, `review/consistency/2026/09/04/18_51_26/*`
  - 상세: 이 파일들은 `CLAUDE.md` "정보 저장 위치" 표가 규정한 대로 리뷰/일관성 검토 산출물이 해당 디렉터리에 영구 보존되는 정상 흐름이다. 내용 자체(수치·인용)는 위 검증 절차에서 소스와 교차검증했고 불일치가 없었다.

CRITICAL/WARNING 급 문서화 결함은 발견되지 않았다.

## 점검 관점별 평가

1. **독스트링/JSDoc** — `QueryExecutionDto` 클래스 JSDoc, `swagger-dto-contract-guard.ts` 의 `@Transform` 예외 rationale JSDoc 둘 다 제거/변경 사유·근거·실측치를 담아 신설·갱신됐다. `validation.pipe.spec.ts` 의 신규 `describe` 블록 위에도 왜 이 테스트가 필요한지("없으면 무엇을 놓치나")를 설명하는 JSDoc 성격 주석이 붙었다. 양·질 모두 충분하다.
2. **README 업데이트** — 신규 기능·설정이 아니라 죽은 쿼리 파라미터 제거이므로 해당 없음.
3. **API 문서** — OpenAPI 는 런타임 생성(NestJS `SwaggerModule`)이고 저장소에 정적 산출물이 없어 데코레이터 제거만으로 자동 반영된다. `spec/2-navigation/14-execution-history.md:345` 는 애초에 이 파라미터를 약속한 적이 없어(실측 확인) spec 정정 불요라는 CHANGELOG 의 주장이 정확하다.
4. **주석 정확성** — 가드 파일의 `@Transform` 예외 JSDoc 이 옛 예시(`workflowId`)를 참조하던 것을 필드 제거·실사례 0건에 맞춰 정확히 갱신했다. 취소선 없이 문단 전체를 교체하는 방식이지만, 원래 그 자리가 developer 가 스스로 쓴 "예고" 성격이 아니라 판정 로직의 rationale 이므로 이 프로젝트의 "자기-반증형 소정정" 5조건(spec 파일 한정)과는 무관하다 — 소스 코드 주석 정정에 그 조건이 적용될 필요는 없다.
5. **인라인 주석** — 필드 삭제라는 단순 diff 라 별도 인라인 주석이 필요한 복잡한 로직은 없다. 클래스 JSDoc 이 "왜 이 필드가 없는가" 를 충분히 답한다.
6. **변경 이력(CHANGELOG)** — 표·영향 절·"배포 시 확인" 경고·실측 근거·"저장소 안에서 확인한 것" 한정 문구까지 갖춰 기존 항목들과 형식·톤이 일관되고, 직전 라운드 W1(관측 범위 과장 우려)을 정확히 반영해 문구를 좁혔다.
7. **설정 문서** — 신규 env/설정 없음. 해당 없음.
8. **예제 코드** — 별도 사용 예제 불요. CHANGELOG "영향" 절이 그 역할을 대신한다.

## Plan 문서 위생 점검

`plan/in-progress/spec-draft-nullable-notation-followups.md` 는 이번 diff 에서 두 가지를
동시에 고쳤다 — ① 항목 종결(체크박스 `[x]` + 트래커 표 취소선, 두 곳 동기화 확인), ②
직전 라운드 W3 이 지적한 "열려 있는 것은 **넷**" 하드코딩 카운트를 **아예 제거**하고
"개수의 단일 진실은 `## 후속` 의 미체크 체크박스" 라는 원칙으로 대체했다. 이는 같은
자리가 두 번(2R W1, `18_34_04` W3) 낡았던 근본 원인(형태 문제)을 구조적으로 제거한
조치로, 재발 방지 관점에서 적절하다.

## 요약

핵심 변경(죽은 쿼리 파라미터 제거)의 문서화는 CHANGELOG·클래스 JSDoc·가드 rationale
JSDoc·plan 트래커·신규 테스트 주석 다섯 곳에서 일관되고 정확하다. 모든 실측 인용(스펙
줄 번호, `@Transform` 필드 수, 소비자 부재)을 직접 열어 대조했고 불일치가 없었다. 이번
diff 는 또한 직전 리뷰 라운드가 지적한 두 결함(테스트 부재 W2, plan 개수 하드코딩 W3)을
정확히 해소했으며, plan 트래커의 개수 표기를 형태 자체로 재발 방지하는 구조 개선까지
포함해 문서화 위생이 오히려 개선됐다. 유일한 잔여 관찰은 이번 diff 범위 밖의 §③ 스냅샷
표 모집단 숫자(1,096)가 이 PR 의 필드 제거로 추가 드리프트했다는 점인데, 문서 스스로
"잰 시점의 값" 원칙을 이미 명시해 뒀으므로 조치 불요 수준의 INFO 다.

## 위험도

NONE
