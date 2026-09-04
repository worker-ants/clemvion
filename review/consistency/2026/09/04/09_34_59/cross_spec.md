# Cross-Spec 일관성 검토 — `spec-draft-nullable-notation-followups.md`

> 조립 메모: 전달된 bundle 은 컨텍스트 예산 초과로 `spec/5-system/2-api-convention.md`(target 이 직접
> 수정하는 파일 자신)·`spec/data-flow/10-triggers.md`·`spec/5-system/1-auth.md` 를 전부 절단했다.
> 이 셋은 이번 draft 의 ①②③ 항목과 가장 밀접한 파일이라, 디스크에서 직접 읽어 대조했다.

## 발견사항

### [WARNING] ③ 의 §5.4 정정이 `spec/conventions/swagger.md` §1-4 의 정본 예제와 새로 어긋난다

- **target 위치**: `plan/in-progress/spec-draft-nullable-notation-followups.md` ③ 변경안 (L132–144)
- **충돌 대상**: `spec/conventions/swagger.md` §1-4 "닫힌 union" 예제 (L92–105) — 및 그 원본인
  `codebase/backend/.../execution-status-response.dto.ts` 의 `ExecutionStatusDto.context`
- **상세**: swagger.md §1-4 는 닫힌-union 필드의 **정본(canonical) 예제**로 다음을 싣는다.

  ```ts
  @ApiPropertyOptional({ oneOf: [...], nullable: true })
  context?: ButtonsContextDto | NodeOutputContextDto | null;
  ```

  이 필드는 EIA `getStatus` 응답에서 `"context": {...} | null` — **항상 키가 존재**하고 대기 상태가
  아닐 때만 `null` 인 필드다(`spec/5-system/14-external-interaction-api.md` §5.3 wire 예시로 확인).
  즉 §5.4 분류상 "`null` (키 present, 상시 존재)" 케이스이지, "키 생략" 케이스가 아니다.

  **현행(수정 전) §5.4 문면** 은 이 케이스에 `@ApiPropertyOptional({nullable:true}) field?: T|null` 을
  요구하므로, swagger.md 의 이 예제는 **지금은 규약을 정확히 따르고 있다**(실제 코드도 그렇게
  선언돼 있음 — 실측 확인).

  ③ 의 변경안이 반영되면 이 케이스의 요구 선언이 `@ApiProperty({nullable:true}) field: T|null`
  (`?` 없음)로 바뀐다. 그러나 swagger.md §1-4 는 target 의 `spec_impact` 목록에 없고, 그 예제 코드는
  그대로 남는다 — **"닫힌 union 을 어떻게 선언하는가"의 정본 예제가, §5.4 가 막 고친 그 안티패턴을
  계속 시연**하게 된다. 두 문서 다 실제 DTO 관례를 규정하는 SoT 성격이라, 다음 사람이 swagger.md
  예제를 그대로 복사하면 ③ 이 고치려던 바로 그 형태(70곳 부류)를 새로 만든다.
- **제안**: `spec_impact` 에 `spec/conventions/swagger.md` 를 추가하고 §1-4 예제를 §5.4 정정 형태에
  맞게 갱신하거나, 최소한 "이 필드는 present-when-available 이 아니라 상시-존재+nullable 이므로
  §5.4 정정본을 따라야 한다"는 각주를 단다.

### [WARNING] ② 가 `/api/auth/*` 예외를 성문화하면서, §2.2 에 이미 있던 인접 갭(단일 동사 action 패턴 미문서화)은 그대로 둔다

- **target 위치**: `plan/in-progress/spec-draft-nullable-notation-followups.md` ② 변경안 (L73–86)
- **충돌 대상**: `spec/5-system/2-api-convention.md` §2.2 (L45–54, target 이 직접 수정하는 절) ·
  `spec/3-workflow-editor/3-execution.md` L757
- **상세**: `3-workflow-editor/3-execution.md` L757 는 다음과 같이 적고 있다.

  > "경로는 api-convention §2.2 의 **단일 동사 action 패턴**(`/execute`·`/stop` 선례)을 따라..."

  그런데 현재 §2.2 는 그런 패턴을 문서화하고 있지 않다 — 예외는 두 개뿐이고(RPC-style
  **sub-channel** action(`/{resource}/{id}/{channel}/{action}`, 3-세그먼트) · 인증 family), 둘 다
  `/api/workflows/:id/execute` 같은 **2-세그먼트** 단일 동사 action(`/{resource}/{id}/{action}`)을
  포섭하지 않는다(RPC-style 예외는 `channel` 세그먼트를 요구). `/re-embed`·`/reveal`·`/regenerate`·
  `/preview-models`·`/test` 등도 같은 모양이다. 즉 §2.2 는 이미 "다음 사람이 규칙에서 선례를
  찾을 수 없는" 상태다 — 이번 draft 가 지적하는 `/api/auth/*` 문제와 **같은 증상**이다.
  ② 는 §2.2 를 정확히 이 지점에서 편집하면서도 `/api/auth/*` 하나만 좁게 성문화하고, 바로 옆의
  더 넓은(그리고 이미 다른 문서가 존재를 전제하는) 갭은 손대지 않는다.
- **제안**: 이번 draft 범위를 넓히거나, 최소한 "단일 동사 action 패턴은 §2.2 미문서화 상태로
  남아있고 별도 후속으로 분리한다"는 한 줄을 Rationale 에 남겨 `3-workflow-editor/3-execution.md`
  L757 의 존재하지 않는 참조를 아는 채로 defer 했다는 근거를 만든다.

### [WARNING] ② 의 "verb-style 20개" 실측이 실제로는 최소 2개(`oauth/:provider`, `2fa/webauthn/availability`) 누락

- **target 위치**: `plan/in-progress/spec-draft-nullable-notation-followups.md` ② 실측 표 (L56–72)
- **충돌 대상**: `spec/5-system/1-auth.md` L179(`/auth/2fa/webauthn/availability`), L505–507
  (`GET /api/auth/oauth/:provider` "OAuth 시작") · `codebase/backend/src/modules/auth/auth.controller.ts`
  L520(`@Get('oauth/:provider')`) · `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts`
  L77(`@Get('availability')`)
- **상세**: draft 는 `oauth/providers`(복수형, 규칙 준수) 와 `oauth/:provider/callback`(20개 목록에
  포함) 만 언급하고, 그 사이의 **`GET /api/auth/oauth/:provider`("OAuth 시작")** 는 20개 목록에도,
  "규칙 준수" 열외 설명에도 없다. `GET /api/auth/2fa/webauthn/availability` 도 마찬가지로 실측에서
  빠졌다 — `spec/5-system/1-auth.md` L179 는 이를 "Public GET" 읽기 전용 capability 조회로
  명시한다. 이 엔드포인트는 새 예외 조항의 근거 문구("인증 상태 전이 — 자격 검증·세션 발급/파기·
  비밀번호 재설정·2FA 등록/해제")에 깔끔히 들어맞지 않는다(읽기 전용이라 "상태 전이"가 아니다).
  즉 새 예외 조항을 문면 그대로 적용하면 `availability` 는 예외에도, 규칙 준수에도 속하지 못하는
  **제3의 미분류 경로**로 남는다.
- **제안**: 실측 표에 두 경로를 추가하고, `availability` 처럼 상태 전이가 아닌 읽기 전용 액션까지
  포섭하려면 예외 문구의 "상태 전이" 한정을 "상태 전이 또는 인증 관련 read-only capability 조회"로
  넓히거나, 별도 사유(단일 컨트롤러 네임스페이스 하위 read 엔드포인트는 sub-channel 로 취급 등)를
  덧붙여야 한다.

### [WARNING] ① 이 손대는 `next_run_at` 자매 문구 — `spec/1-data-model.md` §3 인덱스 전략의 "스케줄러" 서술이 `data-flow/10-triggers.md` 의 BullMQ-only 아키텍처와 이미 어긋난다

- **target 위치**: `plan/in-progress/spec-draft-nullable-notation-followups.md` ① 변경안 (L39–52,
  특히 L44 `spec/1-data-model.md` §2.9 표 수정 지점)
- **충돌 대상**: `spec/1-data-model.md` §3 인덱스 전략 표 — `Schedule | (next_run_at, is_active) |
  스케줄러 다음 실행 대상 조회` 행 · `spec/data-flow/10-triggers.md` §1.3(L15, L105)
  "Schedule 은 **BullMQ repeatable job (job scheduler)** 으로 발사된다. 별도의 DB polling/sweep 은
  없다"
- **상세**: `next_run_at` 은 이번 draft 가 바로 손대는 필드다. 그런데 같은 문서(`1-data-model.md`)
  §3 인덱스 전략은 이 필드 위 인덱스의 존재 이유를 **"스케줄러 다음 실행 대상 조회"** 라고
  적어, DB 를 폴링해 다음 실행 대상을 찾는 스케줄러가 있는 것처럼 서술한다. 그러나
  `data-flow/10-triggers.md` §1.3 은 발사가 전적으로 BullMQ repeatable job 이 담당하며 "DB
  polling/sweep 은 존재하지 않는다"고 명시하고, draft 자신도 §3.2 인용에서 이를 그대로 재확인한다
  ("`next_run_at` 은 발사 트리거가 아니라 UI 표시용 정보성 컬럼"). 코드 실측으로도 확인된다 —
  `schedules.service.ts` 는 `next_run_at` 을 목록 **정렬 컬럼**(화이트리스트, `is_active` 필터
  없음)으로만 쓰고, "다음 실행 대상"을 찾는 폴링 쿼리는 어디에도 없다. 즉 §3 인덱스 표의 저 한
  줄은 BullMQ 이전 설계의 잔재로 보이며, draft 가 §2.9 를 고치는 바로 그 순간 나란히 놓고 보면
  모순이 눈에 띈다.
- **제안**: ① 의 변경 범위에 이 인덱스 설명 한 줄의 정정(또는 "레거시 서술 — 실사용은 목록 정렬"
  각주)을 포함하거나, 최소한 후속 항목으로 별도 기록한다.

### [INFO] ① 의 NULL 공식화 이후 `spec/2-navigation/3-schedule.md` 의 "다음 실행 시각" 열에 NULL 표시 규칙이 없다

- **target 위치**: `plan/in-progress/spec-draft-nullable-notation-followups.md` ① 변경안 (L44–52)
- **충돌 대상**: `spec/2-navigation/3-schedule.md` §2.1 (L58) "다음 실행 시각 | 다음 예정된 실행
  시각 (절대 시간)"
- **상세**: `next_run_at` 이 NULL 일 수 있음을 스펙 레벨에서 처음 공식화하는데, 스케줄 목록 UI
  스펙은 그 값이 없을 때 무엇을 보여주는지 정의하지 않는다. 실측 결과 FE 코드
  (`codebase/frontend/.../schedules/page.tsx` L1080-1082)는 이미 `schedule.nextRunAt ? ... : "-"`
  로 방어적으로 처리하고 있어 **동작 위험은 없다** — 문서만 뒤처져 있다.
- **제안**: §2.1 표에 "값이 없으면 `-` 표시(cron 파싱 실패 등)" 한 줄을 곁들이면 §2.9 정정과
  대칭이 맞는다. 급하지 않음.

## 요약

target 이 실제로 고치겠다는 세 지점(§2.9 nullable 표기·§2.2 예외 조항·§5.4 DTO 규칙) 자체는
사실관계가 실측으로 잘 뒷받침되고, 서로 직접 모순되는 CRITICAL 급 충돌은 발견되지 않았다.
다만 세 항목 모두 **바로 옆 자리에 같은 종류의 미해결 drift 를 남긴다** — ③ 은 `swagger.md` 의
정본 예제를 갱신하지 않아 새 규칙과 옛 규칙이 서로 다른 문서에서 공존하게 되고, ②는 §2.2 를
고치는 김에도 이미 다른 문서가 존재를 전제하는 "단일 동사 action" 갭을 남기며 자체 실측도
완전하지 않고(최소 2개 누락), ①은 같은 문서 안에서 스스로와 모순되는 인접 서술(§3 인덱스
"스케줄러" 폴링 묘사)을 그대로 둔다. 넷 다 "채택하면 즉시 깨진다"는 CRITICAL 은 아니지만,
셋 다 "이번 편집 김에 정리하지 않으면 다음 사람이 또 같은 형태의 지적을 반복한다"는 성격이라
WARNING 으로 등재한다.

## 위험도

MEDIUM
