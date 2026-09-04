# API 계약(API Contract) 리뷰

## 범위 확정

`git diff --stat origin/main...HEAD` 로 실측한 결과 이번 changeset 은 38개 파일, 그중 API
계약과 관련될 수 있는 실질 변경은 **5개뿐**이다 — 나머지 33개(`review/code/2026/09/04/19_43_18/**`,
`review/code/2026/09/04/20_16_17/**`, `review/consistency/2026/09/04/20_05_42/**`)는 이전
두 코드 리뷰 라운드 + consistency check 라운드의 산출물이 이 브랜치에 신규 커밋으로 포함된
것으로, 리포트 문서 그 자체이지 API 표면이 아니다.

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold`: `number` → `string`, `@ApiProperty({ example: 10 })` →
   `@ApiProperty({ type: String, example: '10.0000' })`.
2. `CHANGELOG.md` — 위 변경의 breaking-change 고지 섹션.
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 회귀 방지용
   술어 `findNumericAsNumber` (AST 기반, 제3의 계약 검증 축).
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의
   저장소 전수 테스트 + 대조군(정규식 위음성 4형태·경로 정규화·명명 관례 한계).
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신(코드
   아님).

이 5개 파일은 **직전 두 라운드(`19_43_18`, `20_16_17`)에서 이미 API 계약 관점으로 리뷰됐고**,
`git diff origin/main...HEAD -- <각 파일>` 로 현재 저장소 상태를 직접 대조한 결과 그 라운드들이
확인한 최종(WARNING 전량 해소·`RESOLUTION.md` 반영) 상태와 **바이트 단위로 동일**하다. 즉 이번
라운드에서 API 표면에 새로 추가된 변경은 없다 — 이번 diff 가 "새로" 담고 있는 것은 이전 두
라운드의 리포트 파일 자체다.

## 발견사항

- **[INFO]** `threshold` 타입 정정은 wire·엔티티·프런트엔드 소비자와 재확인 결과 정합
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:20-29`
  - 상세: `@Column({ type: 'numeric', precision: 12, scale: 4 })` 컬럼을 TypeORM 이 문자열로
    반환하는 실제 wire 에 OpenAPI 선언(`number`)이 맞지 않던 것을 `string` 으로 정정했다.
    `codebase/frontend/src/lib/api/alerts.ts` 는 이미 읽기 타입을 `string`, 쓰기 타입을
    `number` 로 손수 분리해 두고 있어 유일한 내부 소비자에는 영향이 없다.
    `ClassSerializerInterceptor` 가 저장소 전역에 없어 이 DTO 는 런타임 직렬화에 관여하지
    않는 순수 Swagger 문서 메타데이터라는 점도 (앞선 라운드의 실측을) 재확인했다. 런타임
    breaking change 없음.
  - 제안: 없음.

- **[INFO]** CHANGELOG breaking-change 고지가 자매 항목과 동일 형식으로 보강돼 있음
  - 위치: `CHANGELOG.md:3-40`
  - 상세: `**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서 threshold 가 number → string
    으로 바뀐다…` 문단이 포함돼 있고, 원인 서술도 `list`/`create`/`update` 세 응답 모두를
    명시한다. 라우트 표기도 `GET /api/alerts` (실제 `@Controller('alerts')` 경로)로 정확하다
    — 직전 consistency-check 라운드(`20_05_42`)가 지적했던 `/api/alerts/rules` 오기가 이미
    정정된 상태다.
  - 제안: 없음.

- **[INFO]** 신설 회귀 가드(`findNumericAsNumber`)가 AST 기반이고 CI 상시 배선됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:207-349`,
    `swagger-dto-contract.spec.ts:281-419`
  - 상세: `collectTsFiles(SRC_ROOT)` 전수 스캔이라 backend jest 표준 실행에 자연히 포함되는
    상시 가드다. 정규식이 아니라 TS AST(`ts.isPropertyDeclaration`/`callDecorators`)로 짜여
    있어, 이전 라운드가 정규식 초판에서 재현했던 4가지 위음성(중첩 객체 옵션·데코레이터-선언
    동일 줄·접근 제한자·사이에 낀 다른 데코레이터)을 대조군으로 고정해 통과함을 확인했다.
    경로 판별도 `toPosixPath` 정규화 후 수행해 이전 라운드가 지적한 Windows 경로 구분자
    문제도 닫혀 있다. **알려진 스코프 제한**은 `<Entity>Dto` 이름 관례에 의존하는 것인데,
    이는 docstring 과 음성 대조군(`StatisticsResponseDto`)으로 명시적으로 문서화돼 있고
    현재 저장소에 실질 갭이 없음을 확인했다.
  - 제안: 없음(문서화된 의도적 스코프이며 현재 시점 실질 갭 없음).

- **[INFO]** 읽기(`string`)/쓰기(`number`) 비대칭은 이번 diff 범위 밖의 기존 의도된 설계
  - 위치: `alert-rule-response.dto.ts` (응답) vs `codebase/backend/src/modules/alerts/dto/alert-rule.dto.ts`(요청, diff 밖)
  - 상세: `CreateAlertRuleDto.threshold` 는 여전히 `number` 를 받고 서비스가 `String(...)` 으로
    저장한다. 요청 검증(요청 바디 유효성) 관점에서 문제는 없다 — 사용자 입력 UX 상 자연스러운
    선택이며, 이번 diff 가 새로 만든 비대칭이 아니다.
  - 제안: 조치 불요(범위 밖). `spec/1-data-model.md:873` 의 `Float` 라벨 정정과
    `spec/conventions/swagger.md` 에 numeric 불변식 성문화는 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 항목으로
    등재돼 있어 이 PR 의 책임 범위가 아니다.

- **[INFO]** 나머지 33개 신규 파일(`review/code/**`, `review/consistency/**`)은 API 표면이
  아닌 리뷰 리포트/메타데이터
  - 위치: `review/code/2026/09/04/{19_43_18,20_16_17}/**`,
    `review/consistency/2026/09/04/20_05_42/**`
  - 상세: 엔드포인트·DTO·에러 응답·페이지네이션·인증/인가 어느 것도 정의하지 않는 마크다운
    리포트와 `_retry_state.json`/`meta.json` 오케스트레이션 메타데이터다. API 계약 관점에서
    검토할 대상이 없다.
  - 제안: 없음.

## 요약

이번 changeset 의 API 계약 관련 실질 변경(`AlertRuleDto.threshold`: `number` → `string` +
회귀 가드 신설)은 직전 두 코드 리뷰 라운드(`19_43_18`, `20_16_17`)와 consistency-check
라운드(`20_05_42`)를 거치며 지적된 WARNING(회귀 테스트 부재·영향범위 서술 축소·codegen
고지 누락·JSDoc 내부 서사 노출·라우트 오기)이 모두 해소된 상태다. `git diff` 로 현재 저장소를
직접 대조한 결과 이번 라운드에서 그 5개 실질 파일에 새로 추가된 변경은 없으며, 이번 diff 가
새로 담고 있는 나머지 33개 파일은 이전 라운드들의 리뷰 리포트 자체(API 표면 아님)다. 요청
검증·에러 응답·URL 설계·페이지네이션·인증/인가 어느 축에도 이번 changeset 이 관여하지 않는다.
남은 항목(spec `Float` 라벨 정정, `swagger.md` 규약화)은 이미 plan 문서에 planner 트랙으로
등재돼 있어 이 PR 의 범위 밖이다.

## 위험도

LOW
