# 유지보수성(Maintainability) 리뷰 — `trigger-workflow-ref` 캐너리 3파일

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` · `trigger-workflow-ref.spec.ts` ·
`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (+ plan 문서 2건, 리뷰 범위 밖으로 간주).

## 발견사항

- **[WARNING]** `TRIGGER_SECRET_COLUMNS` 두 값 `['notificationSecretV2', 'chatChannelTokenV2']` 이
  이제 **세 번째** 독립 사본이 됐다 — production `triggers.service.ts` 의
  `TRIGGER_RESPONSE_STRIP_COLUMNS` 와 값·순서가 완전히 동일하고, 자매 `schedule-trigger-ref.ts` 의
  `TRIGGER_SECRET_COLUMNS` 와도 완전히 동일하다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:48-51` (신규) ·
    대조: `codebase/backend/src/shared/testing/schedule-trigger-ref.ts:24-27` (기존 사본) ·
    `codebase/backend/src/modules/triggers/triggers.service.ts:99-102`(비-export `const
    TRIGGER_RESPONSE_STRIP_COLUMNS`, production SoT).
  - 상세: 프롬프트가 인용한 "일부 shape 만 겹쳐서 `User` 프로젝션 상수 공유를 거부한 선례"를
    grep·git log 로 추적했으나 정확히 일치하는 커밋을 찾지 못했다(다른 이름의 유사 사례들은
    있었으나 문면이 다름 — 아래 "확인 안 됨" 표기). 다만 그 근거의 형태("shape 가 일부만
    겹치므로 강제 통합하면 한쪽이 왜곡된다")는 **여기엔 성립하지 않는다** — 이 세 리스트는
    "일부만 겹치는 서로 다른 shape" 가 아니라 **완전히 동일한 2개 값, 완전히 동일한 도메인**
    (Trigger 엔티티의 비밀 컬럼)이다. 오히려 이 저장소의 더 가까운 선례는 `CREATOR_PROJECTION`
    사건이다 — 동일 리터럴 `{id,name,email}` 이 4곳에 손으로 복제돼 있다가 `findByWorkflow` 만
    옳고 `findOne` 은 틀린 비대칭이 실제 Critical 로 터졌고(`review/code/2026/09/06/10_53_48`),
    그 교훈으로 `CREATOR_PROJECTION` 단일 상수 + DTO 스키마 대조 테스트로 통합됐다. 지금
    `TRIGGER_SECRET_COLUMNS`/`TRIGGER_RESPONSE_STRIP_COLUMNS` 는 그 정확히 같은 모양의 위험을
    다시 만들고 있다 — production 이 세 번째 비밀 컬럼을 추가해도 두 테스트 헬퍼 중 하나(또는
    둘 다)가 갱신을 놓치면, 그 헬퍼는 **테스트 실패 없이 조용히** 새 비밀 컬럼 유출을 못 잡는
    상태로 계속 통과한다 — export 도 안 돼 있고(그레핑 결과 `TRIGGER_RESPONSE_STRIP_COLUMNS`
    는 non-export) 세 목록을 서로 대조하는 테스트도 없다.
  - 제안: `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 production 파일에서 export 하고 두 테스트
    헬퍼가 그것을 import 하게 하거나, 반대로 `shared/testing/` 에 단일 상수를 두고
    `triggers.service.ts` 가 그것을 참조하게 한다. 최소한 세 목록이 동일해야 한다는 것을
    검증하는 self-spec 케이스(예: `expect(TRIGGER_SECRET_COLUMNS).toEqual(REF_LIST_FROM_OTHER_FILE)`)
    하나만 추가해도 드리프트가 조용히 지나가는 것은 막을 수 있다.

- **[WARNING]** UUID 형식 검증 정규식을 새로 손으로 적었는데, 정확히 같은 패턴이 이미
  export 된 유틸리티로 존재한다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:56-57`
    (`const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;`)
    — 대조: `codebase/backend/src/common/utils/uuid.ts:43-47` (`UUID_SHAPE_PATTERN` /
    `export function isUuidShaped`), 바이트 단위로 동일한 정규식.
  - 상세: `common/utils/uuid.ts` 의 `isUuidShaped` 는 이미 정확히 이 용도("Postgres `uuid`
    컬럼이 파싱할 수 있는 형태인가" — nil UUID·v6/v7 도 허용)로 문서화·export 돼 있고, 그
    docstring 은 그 정책이 한 번 앵커 정정을 겪었다고 밝힌다(`#1112`). `workflow.id` 는
    Postgres `uuid` 컬럼이므로 이 헬퍼가 검증하려는 것과 정확히 같은 개념인데, 새 헬퍼는
    그 유틸을 import 하지 않고 같은 정규식을 인라인으로 다시 적었다. 두 정규식이 "우연히
    같다" 는 사실을 아는 사람이 없으면, 훗날 `isUuidShaped` 의 정책이 다시 조정될 때(예:
    canonical 형태 판정 기준이 바뀔 때) 이 파일은 조용히 남겨진다.
  - 제안: `import { isUuidShaped } from '../../common/utils/uuid'` 로 교체하고
    `expect(String(ref.id)).toMatch(UUID_PATTERN)` 을
    `expect(isUuidShaped(String(ref.id))).toBe(true)` 로 바꾼다.

- **[INFO]** `beforeAll` 자체 타임아웃 `120_000` 이 설명 없는 매직 넘버다 — 같은 파일이
  타이밍 상수 하나하나에 실측 근거를 다는 것과 대비된다.
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:121` (`}, 120_000);`)
    대조: 같은 파일 `:52`(`const CHAT_CHANNEL_TIMEOUT_MS = 60_000;`)는 파일 헤더 docstring
    39-46번째 줄에서 "telegram client 5초×3회+백오프 ≈18초 최악값" 이라는 계산까지 붙어 있다.
  - 상세: `beforeAll` 도 `chatChannel` 이 실린 생성 호출(114-116번째 줄)을 포함해 같은 비용
    축을 하나 문다 — 그런데 왜 60_000(기본 e2e 타임아웃)의 정확히 2배인 `120_000` 을 골랐는지
    설명이 없다. 이 파일 자신의 헤더 docstring 이 "이 비용을 모르면 캐너리가 기본 타임아웃에서
    flaky 로 죽고, 원인을 재조회 분기가 아니라 테스트 탓으로 오진한다" 고 명시적으로 경고하는
    바로 그 클래스의 위험이 이 숫자에는 적용되지 않았다.
  - 제안: 한 줄 주석으로 "회원가입+워크스페이스+워크플로 생성(3회) + chatChannel 생성 1회
    (~18초 최악)" 식의 산식을 남기거나, `CHAT_CHANNEL_TIMEOUT_MS * 2` 처럼 기존 상수에서
    파생시켜 두 숫자가 같은 근거를 공유함을 코드로 드러낸다.

- **[INFO]** `it()` 시나리오 라벨이 숫자(`'1. ...'`~`'5. ...'`)를 쓰는데, 이 저장소의 기존
  e2e 라벨 관례는 문자(`'A. ...'`, `'B. ...'`, …)다.
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:132,140,153,162,180`
    대조: `codebase/backend/test/app.e2e-spec.ts:99,136,157,186,229`,
    `codebase/backend/test/agent-memory-admin.e2e-spec.ts:65,137,172,230,290` 등은 전부
    `A./B./C./D./E.` 를 쓰고, 이 관례("라벨=등장 순서")는 과거 리뷰 라운드
    (`review/code/2026/09/06/10_13_22` 등)에서 라벨 충돌·순서 역전이 실제 지적 사항이었을
    만큼 이 저장소가 신경 쓰는 관례다.
  - 상세: 기능적 문제는 아니다 — 이 파일은 `test/trigger-workflow-ref.e2e-spec.ts` 전용
    describe 하나뿐이라 문자/숫자 어느 쪽이든 라벨 충돌 위험이 없다. 다만 이 파일을 템플릿
    삼아 다음 캐너리를 만드는 사람이 어느 쪽이 관례인지 헷갈릴 근거를 남긴다 — plan 설계
    문서(`plan/in-progress/trigger-workflow-ref-canary.md` T-3 표)도 숫자를 썼으므로 의도적
    선택으로 보이지만, 코드 안에는 "왜 숫자인가"에 대한 언급이 없다.
  - 제안: 굳이 통일할 필요는 낮지만, 다음에 문자 관례를 쓰는 파일 옆에 숫자 관례 파일이 있는
    것이 눈에 띄면 정정 대상이 될 수 있다는 점만 기록해 둔다.

- **[INFO]** 헬퍼 docstring 의 "왜 `test/helpers/` 가 아니라 여기인가" 절이 인용하는 세
  가지 설정 사실(`jest.config.ts` 의 `rootDir: 'src'`, `test/jest-e2e.json` 의
  `testRegex: '.e2e-spec.ts$'`, `tsconfig.build.json` 의 `src/shared/testing/**` exclude)은
  **현재는 전부 정확함을 직접 확인**했다. 다만 이 세 파일 중 어느 하나가 바뀌어도 이 docstring
  이 틀렸다는 것을 알려줄 테스트는 없다 — 조용히 낡을 수 있는 서술이다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:33-39`
    (`## 왜 test/helpers/ 가 아니라 여기인가` 절).
  - 상세: 이 절은 다른 절(왜 필요한가·자매와 차이·명명 규칙)과 달리 **외부 설정 파일의 현재
    상태를 근거로 든다** — 코드나 리뷰 이력이 아니라 `jest.config.ts`/`tsconfig.build.json` 이
    사실상 이 절의 SoT다. 이 세 파일이 바뀌면(예: unit jest 가 `test/` 도 스캔하게 바뀌거나,
    `tsconfig.build.json` 의 exclude 패턴이 재구성되면) self-spec 이 "영구히 안 도는" 상태가
    될 수 있는데, 이 docstring 은 그 변화를 감지할 방법이 없다 — 정확히 이 PR 이 dead-test
    를 막으려고 쓴 절이 자신도 같은 클래스의 위험(설정 드리프트)에 노출돼 있다.
  - 제안: 이 세 가지를 코드로 못 박는 것까지는 과할 수 있으나, 최소한 이 절 끝에 "이 절의
    전제가 깨지면 self-spec 이 CI 리포트에 안 잡힌다 — 테스트 스위트 개수 변화를 주기적으로
    확인" 정도의 한 줄 경고를 남기면 다음 설정 변경자가 이 파일의 존재를 상기하게 된다.
    (plan 문서에 이미 이 문면 자체를 `PROJECT.md` 에 반영하자는 후속 항목이 있으므로 그
    반영이 되면 이 리스크는 자연히 줄어든다.)

- **[INFO]** 자매 헬퍼와 "성격이 다르다" 는 설계는 타당하지만, 두 방향의 오용 결과가
  **비대칭**이라는 점은 docstring 에 없다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:16-23` (자매 비교 절) ·
    대조: `codebase/backend/src/shared/testing/schedule-trigger-ref.ts:39-52`
    (`expectNarrowedScheduleTriggerRef`).
  - 상세: `expectNarrowedScheduleTriggerRef` 는 **바깥 객체의 키셋 전체**를 등가 비교하고,
    `expectTriggerWorkflowRef` 는 **`workflow` 키의 유무 + 그 안의 shape** 만 본다(바깥
    `TriggerDto` 전체의 키셋은 보지 않는다). 옵션 이름을 다르게(`present` vs `withWorkflow`)
    한 것은 TypeScript 구조적 타이핑 덕에 옵션 객체를 서로 바꿔 넘기면 컴파일 에러가 나
    실수를 잡아 준다 — 좋은 설계다. 그러나 **함수 자체를 잘못 골라 쓰는 실수**는 방향에 따라
    결과가 다르다: `expectNarrowedScheduleTriggerRef` 를 `TriggerDto` 전체에 잘못 쓰면
    `TriggerDto` 가 가진 추가 필드들 때문에 키셋 비교가 **크게, 시끄럽게** 실패한다. 반대로
    `expectTriggerWorkflowRef` 를 `ScheduleDto.trigger`(좁혀진 참조)에 잘못 쓰면, 바깥
    키셋을 안 보므로 "참조가 실제로 좁혀졌는지" 를 **조용히 검증하지 못한 채** 통과할 수
    있다 — 정확히 자매 헬퍼가 막으려는 결함 클래스(넓은 참조가 새는 것)를 못 잡는 방향의
    오용이다.
  - 제안: 이미 있는 "자매와 성격이 다르다" 절 끝에 "이 헬퍼를 `ScheduleDto.trigger` 에
    쓰면 바깥 키셋 유출을 못 잡는다 — 그쪽은 반드시 `expectNarrowedScheduleTriggerRef` 를
    쓸 것" 한 문장만 추가해도 이 비대칭이 다음 사람에게 드러난다.

- **[INFO]** 실패 메시지가 자매 보안 넷 헬퍼(`user-secret-absence.ts`)보다 진단력이 낮다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:73-75,80,84`
    (`expect(record).not.toHaveProperty(column)` / `expect(Object.hasOwn(...)).toBe(false/true)`)
    대조: `codebase/backend/src/shared/testing/user-secret-absence.ts:72-80`
    (`expectNoUserSecrets` — 유출된 **모든 경로**를 나열하는 커스텀 `Error` 를 던진다).
  - 상세: `Object.hasOwn(record, 'workflow')).toBe(false)` 가 실패하면 Jest 는
    `Expected: false / Received: true` 만 보여준다 — 어떤 dto 였는지, 어떤 키가 문제인지는
    스택트레이스 줄 번호를 보고 소스를 열어야 알 수 있다. 이는 이 파일만의 새로운 결함은
    아니다(자매 `schedule-trigger-ref.ts` 도 같은 스타일의 `toEqual`/`toHaveProperty` 를
    쓴다) — 다만 같은 디렉터리의 `user-secret-absence.ts` 는 "어디서 샜는지 전부 실어
    하나만 고치고 끝내지 않도록" 이라는 명시적 원칙 아래 커스텀 에러를 던지므로, 이
    디렉터리 안에서도 스타일이 통일돼 있지 않다는 점을 남겨 둔다. 캐너리가 6개월 뒤
    누군가에게 낯선 실패로 읽힐 가능성을 낮추는 데는 도움이 될 것이다.
  - 제안: 급하지 않음(INFO). 여유가 있으면 `present:false`/`present:true` 분기 실패 시
    `dto` 의 최상위 키 목록을 함께 던지는 커스텀 메시지를 고려.

## 요약

세 파일은 전반적으로 잘 다듬어져 있다 — 자매 헬퍼(`schedule-trigger-ref.ts`)와 성격을
의도적으로 다르게 가져간 설계는 근거가 명시돼 있고 옵션 이름을 다르게 한 것이 TypeScript
구조적 타이핑으로 실제 오용(옵션 객체 스왑)을 컴파일 타임에 막아 주는 좋은 선택이다(다만
"함수 자체를 잘못 고르는" 오용은 두 방향의 결과가 비대칭이라는 점을 문서화하면 더 안전하다).
self-spec 은 `WITH_WORKFLOW`/`WITHOUT_WORKFLOW` 두 베이스 픽스처를 스프레드로 재사용해
8개 케이스를 DRY 하게 구성했고, 실패해야 하는 경로를 각각 문다는 원칙을 실제로 지켰다.
e2e 파일의 `beforeAll`/`afterAll` 구조, 케이스 간 상태 공유(`plainTriggerId`/`chatTriggerId`),
정리 로직은 자매 `chat-channel-trigger-create.e2e-spec.ts` 와 같은 패턴이라 어색하지 않다.
docstring 의 무게는 대체로 노이즈가 아니라 근거(과거 실측·회귀 이력·설계 판단)다 — 다만
그중 "왜 이 디렉터리인가" 절은 외부 jest/tsconfig 설정을 근거로 들면서 그 설정이 바뀌어도
알려줄 장치가 없다는 점에서, 파일이 스스로 경계하는 "죽은 테스트" 위험의 축소판을 자신도
안고 있다. 가장 실질적인 지적은 **`TRIGGER_SECRET_COLUMNS` 가 production 상수와 함께 이제
세 번째 독립 사본이 됐다**는 것과 **이미 존재하는 `isUuidShaped` 를 재발명**했다는 것 —
둘 다 이 저장소가 과거(`CREATOR_PROJECTION`) 정확히 같은 모양의 사건으로 이미 한 번 데인
패턴이며, 프롬프트가 언급한 "shape 가 일부만 겹쳐 공유를 거부한 선례"는 여기(완전히 동일한
값·완전히 동일한 도메인)에는 그대로 옮겨오지 않는다고 판단한다. 매직 넘버(`120_000`)와
`it()` 라벨 관례 이탈은 경미하다. 필드가 하나 늘어났을 때 바뀌어야 할 자리는
`WORKFLOW_REF_KEYS` 하나로 이미 명명·격리돼 있어 헬퍼 시그니처 자체(`opts: {present:
boolean}`)가 조만간 바뀔 위험은 낮다.

## 위험도

LOW
