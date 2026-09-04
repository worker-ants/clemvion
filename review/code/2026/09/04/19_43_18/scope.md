# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff --stat origin/main...HEAD`(HEAD=`a65a4f85e`)로 실제 diff 가 프롬프트에 제시된
3개 파일과 정확히 일치함을 확인했다(`CHANGELOG.md` +28 · `alert-rule-response.dto.ts` +21/-3 ·
`plan/in-progress/spec-draft-nullable-notation-followups.md` +29/-4, 워킹트리는 clean). 저장소
쓰기는 하지 않았다(`git show`/`git log`/`grep` 만 사용).

커밋 메시지(`a65a4f85e`)가 명시한 의도: "§5.4 drift 2단계(78곳) 착수 전 등재된 검증자 (a)
(패스스루 컨트롤러 반환 타입 명시 → tsc 대조)를 먼저 실측했더니 반증됐고, 그 조사 과정에서
드러난 실재 계약 거짓 1건(`AlertRuleDto.threshold`)을 함께 고친다." 세 파일이 이 단일 서사를
정확히 나눠 맡는다 — 코드 수정(파일 2) · 릴리스 문서화(파일 1) · 조사 결과를 향후 착수자를 위해
plan 에 기록(파일 3).

## 발견사항

발견된 범위 이탈 없음.

- **[INFO]** 자매 커밋(`d8b7cb93e`, `invitedBy` 동일 클래스 수정)은 캐너리 테스트
  (`workspaces.controller.spec.ts` 에 통과/대조군 2건)를 함께 추가했는데, 이번 커밋은 테스트
  파일 변경이 없다(커밋 본문도 기존 스위트 통과만 언급, 신규 테스트는 언급 없음). 이는 "범위
  이탈"(과잉)이 아니라 "범위 미달" 성격이라 이 관점(scope) 체크리스트 8개 항목 중 어디에도
  해당하지 않는다 — 완결성/테스트 커버리지 리뷰어의 관점에 해당하므로 참고로만 남긴다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`

## 항목별 확인

1. **의도 이상의 변경**: 없음. diff 는 정확히 3파일로, 커밋 메시지가 예고한 "검증자(a) 반증 +
   1건 수정" 범위와 1:1 대응한다.
2. **불필요한 리팩토링**: 없음. DTO 파일은 `threshold` 필드의 타입(`number`→`string`)·
   데코레이터(`@ApiProperty({example:10})`→`@ApiProperty({type:String, example:'10.0000'})`)·
   JSDoc 만 바뀌었다(`@@ -17,9 +17,24 @@`). 인접 필드(`window`·`channel`·`workflowId` 등)는
   무변경.
3. **기능 확장**: 없음. CHANGELOG·commit 모두 "wire 는 바뀌지 않는다, 문서만 사실을 따라간다"
   고 명시하고 프런트(`lib/api/alerts.ts`)가 이미 `string` 을 기대하고 있었음을 근거로 든다 —
   순수 문서/타입 정정이지 신규 동작 추가가 아니다.
4. **무관한 수정**: 없음. 3파일 전부 같은 조사·같은 결함에 결속돼 있다. `plan/in-progress/
   spec-draft-nullable-notation-followups.md` 의 diff 범위도 `267~293` 줄, 즉 "검증자(a)/(b)"
   체크리스트 항목 하나에 국한되고 문서의 다른 절(①②③, Rationale 등)은 건드리지 않았다.
5. **포맷팅 변경**: 없음. 세 hunk 모두 대상 블록만 좁게 치환하고 주변 문맥 줄은 그대로다
   (`CHANGELOG.md` `@@ -1,5 +1,33 @@` 로 파일 맨 위에 새 절만 삽입, 이하 기존 절 무변경).
6. **주석 변경**: JSDoc 블록이 8줄로 상당히 길지만, 이는 이 리포지토리/이 DTO 계열의 기존
   컨벤션과 일치한다 — 자매 커밋 `d8b7cb93e`(`WorkspaceInvitationDto.invitedBy`)도 같은 형식
   (사실 정정 + 근거 + 날짜)의 JSDoc 을 달았다. "불필요한 주석"으로 보기 어렵다.
7. **임포트 변경**: 없음. `alert-rule-response.dto.ts` 상단 `import { ApiProperty,
   ApiPropertyOptional } from '@nestjs/swagger';` 는 diff 밖(무변경).
8. **설정 변경**: 없음. 세 파일 중 설정 파일은 없다.

## 요약

`git diff origin/main...HEAD` 실측 결과 변경은 정확히 3개 파일(코드 1·CHANGELOG 1·plan 문서 1)
로, 커밋 메시지가 예고한 단일 서사("검증자 (a) 반증 + 그 과정에서 드러난 `AlertRuleDto.threshold`
계약 거짓 1건 수정")를 벗어나지 않는다. 리팩토링·기능 확장·무관한 파일·포맷팅 뒤섞임·불필요한
임포트/설정 변경 어느 항목도 관측되지 않았다. JSDoc 이 다소 길지만 동일 DTO 계열의 기존 커밋
(`d8b7cb93e`)과 같은 하우스 스타일이라 이탈로 보기 어렵다. 유일하게 눈에 띄는 점은 자매 커밋과
달리 캐너리 테스트가 없다는 것인데, 이는 scope 관점(과잉/이탈)이 아니라 완결성 관점의 사안이라
이 리뷰의 등급에 반영하지 않았다.

## 위험도

NONE
