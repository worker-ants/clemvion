# Cross-Spec 일관성 검토 — `notification_secret_v2` 저장 형태 draft

검토 대상: `plan/in-progress/spec-draft-notification-secret-storage.md`(§③ 변경안 — 이미
`790487f34`로 `spec/5-system/14-external-interaction-api.md §7.1` · `spec/conventions/secret-store.md §1`
· `spec/5-system/2-api-convention.md` frontmatter `code:`에 반영 완료된 상태). 세 파일의 실제
diff·현재 본문, 그리고 target이 인용하는 `chat-channel.md R-K` / `data-flow/15-external-interaction.md §1.5`
/ `1-data-model.md §2.8·§2.10` / `EIA-NX-12`를 직접 읽어 대조했다. 추가로 이 브랜치가 히스토리를
공유하는 병행 브랜치 `claude/sweep-response-contract-5ba0ad`(다른 worktree에 checkout됨)의 관련
커밋·자신의 `review/consistency/2026/09/05/19_08_19` 산출물까지 `git show`로 대조했다 — target
문서 자체가 그 경로를 "다른 브랜치의 push 차단 사유"로 인용하고 있어 그 사유의 실제 내용을
검증하지 않으면 판정이 불완전하기 때문이다.

## 발견사항

- **[CRITICAL]** `secret-store.md` 신규 예외 근거 "1회 노출" 주장이 이 브랜치의 실제 API 동작과 어긋난다
  - target 위치: `spec/conventions/secret-store.md` §1 "비대상 — `Trigger.notification_secret_v2`" 블록의 근거 3번
    (draft 본문 `## ② 결정` → "등재 근거" 항목 3, `plan/in-progress/spec-draft-notification-secret-storage.md:133-134`에
    동일 문구로 먼저 등장 — draft가 그대로 spec에 옮겨 적었다)
  - 충돌 대상: (a) 이 브랜치의 실제 코드 — `codebase/backend/src/modules/triggers/triggers.service.ts`의
    `sanitizeChatChannelForResponse`(line 523)는 `config.chatChannel` JSONB **안의 키만** 지우고
    엔티티 컬럼(`notificationSecretV2`/`chatChannelTokenV2`)은 건드리지 않으며, `TriggerDto`는
    `@Expose()` 화이트리스트 없이 엔티티를 그대로 반환하는 경로다. (b) 병행 브랜치
    `claude/sweep-response-contract-5ba0ad`의 커밋 `dfb2664af`("트리거 회전 secret이 두 경로로
    나가고 있었다 — §5.4 스윕 1차")와 그 브랜치 **자신의** `review/consistency/2026/09/05/19_08_19/cross_spec.md`
    CRITICAL 발견 — `notificationSecretV2`가 `GET/POST/PATCH /api/triggers` **그리고**
    `/api/schedules`(트리거 조인)를 통해 새고 있었음을 실측하고 `sanitizeForResponse`로 수정했다.
  - 상세: `secret-store.md`의 신규 예외 근거 3번은 *"서버 발급·1회 노출·영향 범위가 트리거
    하나 — `wsk_` + `randomBytes(32)`이고 rotate 응답에만 실린다"*고 적는다. 이 "rotate 응답에만
    실린다"는 문장은 **이 브랜치(HEAD `790487f34`, `origin/main` 대비 +1 commit)의 실제 코드 상태와
    다르다** — 위 (a)에서 확인했듯 `notification_secret_v2`는 rotate 응답 외에 일반 트리거
    조회/생성/수정 응답과 schedule 조회 응답에도 실려 나간다. 이는 추측이 아니라 병행 브랜치가
    **같은 필드**를 대상으로 뮤턴트 검증까지 거쳐(`TriggerDto` 2건·`ScheduleDto` 18건 RED)
    실측·수정한 내용과 정확히 일치한다. 즉 target이 새로 등재한 "위험이 낮다"는 근거 문장 자체가,
    같은 필드를 다루는 병행 스펙 작업이 이미 반증한 주장을 재사용하고 있다. target의 커밋 메시지가
    스스로 "§5.4 스윕에서 실제로 그 문턱까지 갔다(자매가 진짜 ref라 더 그럴듯했다)"고 언급하는데도,
    등재된 문구는 그 스윕이 발견한 결과(2-경로 유출)를 반영하지 못한 구버전 프레이밍("1회만")을
    그대로 옮겼다. `notification_secret_v2`가 HMAC 서명에 직접 쓰이는 진짜 평문 secret이라는
    사실을 이번 draft가 막 확정했으므로, 이 노출 범위 오기는 credential 유출 문서의 신뢰도를
    직접 깎는다 — 다음 사람이 이 Rationale을 근거로 "노출 표면이 좁아 안전하다"고 판단할 위험이
    있다(정확히 병행 브랜치 리뷰가 경고한 시나리오).
  - 제안: (a) 이 브랜치에도 `sanitizeForResponse` 류 수정(entity 컬럼까지 스트립 + schedule
    조인 컨트롤러 필드 축소)을 백포트하거나, 그 전까지는 근거 3번 문구를 *"서버 발급·영향
    범위가 트리거 하나 — `wsk_` + `randomBytes(32)`이고 rotate 응답에 1회 노출된다. **단
    현재 이 브랜치의 `/api/triggers`·`/api/schedules` 응답 경로가 엔티티 컬럼을 스트립하지
    않아 grace 기간 동안 통상 조회로도 노출될 수 있다 — 별도 보안 수정 필요(추적: 병행
    브랜치 `claude/sweep-response-contract-5ba0ad`)"* 로 정정. (b) `spec_impact`에 이 사실을
    반영하는 후속 항목(코드 수정 plan)을 추가 — 현재 draft의 "후속(이 PR 밖)"에는 이 항목이
    없다.

- **[WARNING]** Trigger/Schedule 응답이 `notification_secret_v2`/`chat_channel_token_v2`를
  제외해야 한다는 요구사항이 `spec/**` 어디에도 정규화돼 있지 않다
  - target 위치: draft 전체(§③ 변경안), 특히 EIA §7.1 정정문과 `secret-store.md` 신규 예외 블록
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md §7.2`(Execution 엔티티 확장) 부근,
    `spec/2-navigation/2-trigger-list.md`, `spec/5-system/2-api-convention.md §5.4` — 셋 중
    어디에도 "Trigger/Schedule 응답 DTO는 `notification_secret_v2`·`chat_channel_token_v2`를
    제외한다"는 정규 문장이 없다(`grep`으로 전수 확인 — 응답 제외 관련 서술 0건).
  - 상세: 이번 draft는 `notification_secret_v2`가 진짜 평문 서명 secret임을 spec 차원에서
    확정했다. 그렇다면 그 secret이 API 응답에 노출되면 안 된다는 요구사항도 같은 turn에
    정규화하는 것이 자연스러운데, target은 저장 형태(§7.1)만 고치고 노출 경계는 다루지 않았다.
    병행 브랜치가 코드로는 막았지만 그 요구사항을 spec 정규 문장으로 못박은 곳이 없어, 향후
    누군가 `TriggerDto`/`ScheduleDto`를 수정하면서 이 필드를 다시 노출시켜도 spec 근거로
    잡아낼 자리가 없다.
  - 제안: `secret-store.md`의 신규 예외 블록 또는 `14-external-interaction-api.md §7.1`
    정정문에 "본 컬럼은 API 응답 DTO에 노출되지 않아야 한다(§5.4/§swagger §5-1 대상)"는
    한 줄과, 그 시행 코드(`sanitizeForResponse` 또는 후속 이름)를 `code:` frontmatter에
    등재하는 후속 항목을 명시.

- **[INFO]** 검증 완료 — `R-K`·`data-flow §1.5`·`EIA-NX-12`·`1-data-model.md §2.8/§2.10`
  인용은 전부 원문과 정확히 일치
  - target 위치: draft §② 전체, §③ 변경안
  - 상세: `spec/5-system/15-chat-channel.md` R-K 원문(*"두 컬럼은 의미상 직교"*),
    `spec/data-flow/15-external-interaction.md §1.5`의 `secrets.rotate(canonical ref, v2)`
    승격 경로, `spec/5-system/14-external-interaction-api.md`의 `EIA-NX-12`("응답에 새
    secret을 1회 평문 반환") 정의, `spec/1-data-model.md §2.8`의 `notification_secret_v2`
    행("신규 secret") — 전부 target의 인용과 자구 단위로 일치한다. 앵커
    `#r-k-chat_channel_token_v2-컬럼-명명의-semantic-비대칭`도 이 저장소의 기존 앵커 규칙과
    같은 슬러그 생성 방식으로 유효하다. §7.1 정정문의 "`EIA-NX-12`의 '1회 평문 반환'과 다른
    것을 말한다" 각주는 실제로 서로 다른 두 노출 채널(1회성 rotate 응답 vs grace 기간 내내
    존재하는 DB 컬럼)을 정확히 구분하므로 혼동 방지 효과가 있다.

- **[INFO]** `2-navigation/4-integration.md §9.1`(W3) 유예는 실측상 타당
  - target 위치: draft §③ "`spec/2-navigation/4-integration.md §9.1` (W3)"
  - 상세: `mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures`
    5필드는 이 브랜치의 `IntegrationDto`(`codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`)에
    **없다** — `claude/sweep-response-contract-5ba0ad` 브랜치 tip(`a6f582680`)에만 존재하고
    `git merge-base --is-ancestor`로 확인한 결과 그 브랜치는 아직 `origin/main`의 조상이
    아니다. draft의 "그 브랜치가 머지된 뒤에 반영한다"는 순서 판단은 정확하다.

- **[INFO]** `2-api-convention.md` frontmatter `code:` 등재(W2)는 이미 실제로 누락 상태였고 지금은 해소됨
  - target 위치: draft §③ "`spec/5-system/2-api-convention.md` (W2)"
  - 상세: `git diff <이전 커밋>..790487f34`로 확인 — `swagger-dto-contract*.ts`는 원래
    `swagger.md`의 `code:`에만 있었고 `2-api-convention.md`에는 없었다(직전 §5.4 검증자
    등재 커밋 `983fd0ade`도 놓친 부분). 이번 draft의 W2 반영으로 두 파일 모두
    `swagger-dto-contract*.ts`·`response-contract*.ts`·`swagger-probe*.ts` 3종을 공유한다 —
    §5.4 "검증 층" 표의 서술("양쪽 문서의 `code:`에 모두 등재")과 이제 실제 상태가 일치한다.

## 요약

target이 직접 관리하는 세 spec 파일(EIA §7.1, secret-store.md §1, api-convention.md
`code:`)은 인용한 다른 영역(R-K·data-flow §1.5·EIA-NX-12·data-model §2.8/§2.10) 및 병행
브랜치(`sweep-response-contract-5ba0ad`)의 결론과 대부분 정확히 정합한다 — 첫 진단을 반증하고
방향을 뒤집은 판단 자체는 실측으로 뒷받침된다. 그러나 새로 등재한 `secret-store.md` 예외의
근거 문장("1회 노출") 하나가, target이 등재 근거로 삼을 만큼 신뢰한 바로 그 병행 브랜치가 이미
실측·수정한 2-경로 wire 유출 사실과 어긋난다 — 이 브랜치(HEAD)는 아직 그 수정을 포함하지
않으므로 지금 이 순간 문서와 실제 API 동작이 다르다. 첫 라운드에서 "이름의 존재를 설계 의도로
읽었다"고 자인한 것과 같은 급의 오류가, 이번엔 "노출 채널의 부재"를 검증 없이 가정하는 형태로
반복됐다. 병행 브랜치의 보안 수정이 아직 `spec/**` 어디에도 정규 요구사항으로 못박혀 있지 않다는
점도 함께 남는 갭이다.

## 위험도

CRITICAL
