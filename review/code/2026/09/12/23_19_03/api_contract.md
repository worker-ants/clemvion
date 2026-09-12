# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 두 엔드포인트에 관측 가능한 breaking behavior change — 문서화는 충실함
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`decodeCursor` — `if (!isUuidShaped(id)) return null;`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`decodeCursor` — `if (!isUuidShaped(parsed.i)) { throw new Error(...) }`)
  - 상세: `GET /api/users/me/login-history` 는 비-UUID 커서 id 를 받으면 종전 500(마스킹된 22P02)에서 200(커서 무시, 1페이지)으로 바뀌고, `GET /api/executions/:id/background-runs/:runId` 는 500에서 400 `INVALID_CURSOR`로 바뀐다. 둘 다 클라이언트가 관측 가능한 상태 코드 변화이며, 5xx 를 재시도/알림 트리거로 쓰던 모니터링은 신호를 잃는다. 다만 이는 `CHANGELOG.md`에 두 항목으로 명확히 분리 기재되어 있고("⚠️ 배포 시 확인"), `INVALID_CURSOR`는 이미 `spec/4-nodes/1-logic/12-background.md:298`에 등재된 기존 코드를 재사용하므로 새 wire 계약을 만들지 않았다. `GlobalExceptionFilter`(`http-exception.filter.ts`)를 직접 열어 22P02 분기가 실제로 없음을 확인했고, 이 마스킹 주장은 정확하다.
  - 제안: 현재 문서화 수준으로 충분하다고 판단됨(추가 조치 불요). 배포 노트/모니터링 팀 공지 여부만 운영 채널에서 확인.

- **[WARNING]** 동일 개념(keyset 커서)에 실패 계약이 두 갈래로 굳어짐 — 단 이미 자체 추적 중
  - 위치: `plan/in-progress/keyset-cursor-uuid-validation.md` §C, `plan/in-progress/spec-draft-nullable-notation-followups.md` (두 keyset 커서 디코더 실패 계약 불일치 항목)
  - 상세: `spec/5-system/2-api-convention.md §8.2`는 cursor 페이지네이션을 "opaque base64 + 실패 시 400" 단일 표준으로 규정하는데, `login-history`는 평문 `<iso>|<id>` 인코딩 + 실패 시 무시(200)라는 별도 계약을 그대로 유지한 채 이번에 강화됐다. 이번 커밋이 그 비대칭을 새로 만든 것은 아니지만(기존 계약을 "유지"만 함), 두 디코더를 나란히 강화하면서 결과적으로 그 비대칭이 더 굳어졌다("checker 의 표현"으로 plan 문서 자신도 인정). API 계약 관점에서는 같은 종류의 리소스(keyset cursor)에 대해 클라이언트가 예측할 수 있는 실패 모드가 엔드포인트마다 달라 일관성이 떨어진다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목(계약 통일 여부, §8.2 예외 각주 여부)으로 등재되어 있으므로 이번 PR 범위에서 추가 조치는 불필요. 다만 리뷰 관점에서 "완전히 해소된 상태"가 아님을 명시해 둔다.

- **[INFO]** 요청 검증 강화가 실제 보안/안정성 갭을 닫음
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (`isUuidShaped`), 위 두 `decodeCursor` 호출부
  - 상세: 커서의 id 성분이 검증 없이 `uuid` 컬럼에 바인딩되어 인증된 사용자가 임의로 SQLSTATE 22P02 → 500 을 유발할 수 있었던 입력 검증 누락을 닫는다. `isValidUuid`(RFC 엄격 검증) 대신 `isUuidShaped`(Postgres 파싱 가능 형태만 확인)를 쓴 선택은 `spec/data-flow/12-workspace.md §"UUID 검증 강도 비대칭"` 근거와 일치하며, nil UUID·v6/v7 같이 Postgres 가 정상 조회하는 값까지 400 으로 뒤바꾸는 과잉 검증을 피한다. 두 서비스 모두 뮤테이션 테스트(엄격 술어 교체 시 RED)로 이 선택을 회귀 고정했다.
  - 제안: 없음 — 구현이 타당하다.

- **[INFO]** `GlobalExceptionFilter`에 22P02 → 400 일괄 분기를 넣지 않기로 한 결정은 API 계약 관점에서도 타당함
  - 위치: `plan/in-progress/keyset-cursor-uuid-validation.md` §A
  - 상세: 필터는 값의 출처(서버 서명 값 vs 클라이언트 입력)를 구분할 수 없어, 일괄 400 분기는 `3-error-handling.md §1`의 "서버가 서명한 값에 400 을 내면 서버 버그를 클라이언트 오류로 보고하게 된다" 원칙을 어긴다. 입구별 조기 검증(이번 커밋의 접근)이 필터 레벨 일반화보다 계약상 안전하다.
  - 제안: 없음 — 근거가 명확하고 already-won't-do로 정식 종결됨.

## 요약

이번 변경은 keyset 페이지네이션 커서의 id 성분에 대한 입력 검증 누락(인증 사용자가 500 을 유발 가능)을 두 엔드포인트(`login-history`, `background-runs`)에서 각각의 기존 실패 계약을 유지한 채 닫는다. `INVALID_CURSOR`는 기존 등재 코드를 재사용하고 새 wire 스키마 변경은 없다. 관측 가능한 status code 변화(500→200, 500→400) 두 건은 CHANGELOG 에 breaking change 로 명시적으로 기재되어 있어 하위 호환성 리스크가 투명하게 관리되고 있다. 유일한 잔여 이슈는 두 커서 디코더의 실패 계약(무시 vs 400)이 API 컨벤션 §8.2 의 단일 표준과 계속 어긋난다는 점인데, 이는 이번 PR 이 새로 만든 문제가 아니라 기존 비대칭을 유지한 것이며 이미 planner 트래커에 후속 항목으로 명시 등재되어 있다. 인증/인가, URL 설계, 요청 바디 스키마에는 변경이 없다.

## 위험도

LOW
