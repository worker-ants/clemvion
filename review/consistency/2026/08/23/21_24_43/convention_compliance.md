# 정식 규약 준수 검토 — `plan/in-progress/spec-text-fixes.md`

## 검토 범위 및 방법

target 은 `spec/` 이 아니라 `plan/in-progress/` 트래커이며, 아직 체크박스가 모두 미완료
(spec 파일에 실제 반영 전) 인 **작업 계획서**다. 따라서 API 응답/이벤트 페이로드/DTO
명명 같은 출력 포맷 규약이 target 문서 자체에 직접 적용될 표면은 없다. 대신 이 계획이
가리키는 3개 spec 정정(① `15-chat-channel.md`, ② `14-external-interaction-api.md`,
③ `data-flow/15-external-interaction.md`)이 **적용됐을 때** `spec/conventions/**` 와
충돌하지 않는지를 실측으로 확인했다.

- ① 주장 검증: `spec/5-system/14-external-interaction-api.md:113-148` (§3.3.1)에서
  `InteractionRequestContext` 가 이미 `ExternalInteractionRequestContext` /
  `InternalInteractionRequestContext` discriminated union (+`isInternalCtx()`)으로
  **v1 구현 완료** 상태임을 직접 확인. `15-chat-channel.md:319`, `:507` 은 여전히
  "`scope?: 'in_process_trusted'` optional 필드만 추가" 로 서술 — target 의 stale 주장과 일치.
- ② 주장 검증: `spec/5-system/12-webhook.md:293-313` (§5.2)이 이미
  `{ error: { code, message, requestId, details? } }` 정합 봉투를 쓰고 있음을 확인.
  이는 `spec/5-system/3-error-handling.md:21` 이 정의한 공식 봉투, `error-codes.md §1.5
  응답 봉투(envelope) 형식` 참조와 동일 토큰. `14-external-interaction-api.md:331` 의
  "legacy `statusCode/errors` shape" 대비 문구는 근거가 소멸한 상태 — target 주장과 일치.
- ③ 주장 검증: `spec/5-system/14-external-interaction-api.md` 전수 grep 결과
  `EIA-AU-01`~`08` 만 정의, `EIA-AU-09` 없음. `spec/data-flow/15-external-interaction.md:119`
  는 `EIA-AU-08/09` 를 인용 — 미정의 ID 참조가 살아 있음을 확인.

## 발견사항

- **[INFO]** SoT 포인터 치환(①)의 phrasing 관행 참고
  - target 위치: `## 처분 방침 — 각각 다르다` 첫 bullet ("①은 포인터로 대체한다")
  - 위반 규약: 없음 (참고용) — `spec/conventions/audit-actions.md` §Overview 의 "책임 경계"
    bullet 목록(SoT 를 명시적으로 볼드 + 링크로 선언하는 패턴)이 유사 사례
  - 상세: `spec/conventions/**` 에는 "SoT 포인터를 어떻게 적어야 하는가"를 강제하는 규약이
    없다 — 이 관찰은 순수 스타일 참고이며 규약 위반이 아니다. 다만 `audit-actions.md` 처럼
    "본 문서가 유일하게 소유하는 것"/"SoT" 를 명시적으로 볼드 처리해 두면, 이후
    `15-chat-channel.md` 를 훑는 사람이 "여기는 서술 안 함, EIA §3.3.1 이 SoT" 를 즉시
    식별하기 쉽다.
  - 제안: ① 적용 시 `15-chat-channel.md §5.1` 문구에 "SoT: EIA §3.3.1" 형태의 명시적 라벨을
    두면 좋다 (강제 아님, 스타일 통일 제안).

- **[INFO]** 취소선(strikethrough) 정정 관행은 이미 같은 문서 안에 선례가 있다
  - target 위치: `## 처분 방침` 두 번째 bullet ("②는 대비 문구를 지운다 ... 취소선으로 이력을 남긴다")
  - 위반 규약: 없음 — 오히려 부합 사례를 확인
  - 상세: `spec/5-system/14-external-interaction-api.md` 자체에 이미 `~~...~~ **(2026-08-15
    해소)**`, `~~잔여 ①~~ 해소(2026-08-16)` 같은 취소선+해소일자 패턴이 다수 존재
    (예: 591행, 593행, 1547행, 1550행, 1655행). target 이 계획한 ② 처분 방식은 이 문서가
    이미 쓰고 있는 관행과 정확히 일치한다 — 규약 문서(`spec/conventions/**`)에 명문화돼
    있진 않지만 해당 문서 내 기존 패턴과 충돌 없음.
  - 제안: 없음 (그대로 진행 가능). 참고로 이 패턴을 `spec/conventions/` 로 승격할지는
    project-planner 재량.

## 요약

target(`plan/in-progress/spec-text-fixes.md`)은 아직 spec 에 반영되지 않은 계획서이므로
`spec/conventions/**` 의 명명·출력 포맷·API 문서 규약이 target 자체에 직접 적용되는
표면이 거의 없다. 계획이 가리키는 3개 정정 사항(① union stale 서술 → EIA §3.3.1 포인터,
② legacy 대비 문구 제거, ③ 미정의 `EIA-AU-09` 참조 제거)은 모두 실측(코드/스펙 원문 직접
열람)으로 사실관계가 확인됐고, 제안된 처분 방식(SoT 포인터화, 취소선+해소일자 표기,
숫자 좁히기)은 대상 문서들이 이미 채택 중인 관행 및 `error-codes.md`/`error-handling.md`
가 정의한 공식 에러 봉투 규약과 정합한다. `spec/conventions/**` 명시적 위반 항목은
발견되지 않았다.

## 위험도
NONE
