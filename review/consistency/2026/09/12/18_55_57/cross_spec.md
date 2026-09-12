# Cross-Spec 일관성 검토 — chat-channel 문서 잔여 배치

대상: `plan/in-progress/spec-draft-chat-channel-doc-batch.md` (9개 변경안, `spec_impact` 6파일)

## 검토 방법

번들에서 `spec/5-system/2-api-convention.md`·`3-error-handling.md`·`15-chat-channel.md`·
`spec/conventions/swagger.md`·`spec/conventions/chat-channel-adapter.md` 본문이 컨텍스트
예산 초과로 절단돼 있어(기존에 알려진 `--spec` 예산 갭), 해당 5개 파일을 worktree 에서
직접 읽어 각 변경안의 diff base·인접 섹션·상호 참조를 실측 대조했다. 코드 근거(글롭 매처
실행·`grep`)도 함께 확인했다.

## 발견사항

- **[WARNING]** item 1 적용 후 같은 문서의 R-CC-22 Rationale 수치가 stale 해진다
  - target 위치: `spec-draft-chat-channel-doc-batch.md` §1 (`15-chat-channel.md` frontmatter
    `code:` 의 `dto/chat-channel-*.dto.ts` → `dto/**/chat-channel-*.dto.ts`)
  - 충돌 대상: 같은 문서 `spec/5-system/15-chat-channel.md` `### R-CC-22`
    (`...triggers/ 안의 chat-channel 구현 경로를 code: 에서 glob 으로 잡는다`, 878행 부근)
  - 상세: R-CC-22 는 *"좁은 glob 3개는 의도한 **10개를 정확히** 덮는다(차집합 0 · 무관 파일
    유입 0)"* 라고 **수치로 못 박아** 뒀다. 이 "10개"는 `dto/chat-channel-*.dto.ts`(넓히기 전
    glob)를 포함한 계산인데, item 1 이 그 항목만 `dto/**/chat-channel-*.dto.ts` 로 넓히면서
    `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 1개가 새로 매칭 대상에
    들어간다. 즉 넓힌 뒤의 실제 매칭 수는 10 이 아니라 11(혹은 그 이상)이 되는데, R-CC-22 본문은
    그대로 "10개를 정확히" 라고 계속 주장하게 된다. `review_guard._glob_to_regex` 로 직접
    검증한 결과도 draft 의 표(§1)와 일치했다 — 넓힌 glob 이 `chat-channel-config.dto.ts` 는
    그대로 잡고 `chat-channel-rotate-bot-token-response.dto.ts` 를 추가로 잡으며
    `create-trigger.dto.ts` 는 여전히 안 잡는다(과잉 포획 없음). 문제는 글롭 자체가 아니라
    R-CC-22 의 **정량 진술이 이 변경 이후에도 갱신되지 않는다는 것**이다 — 이 저장소가
    "실측 근거 수치는 갈릴 때마다 갱신한다"는 관례(같은 R-CC-22 문단이 스스로 `633/528` 같은
    구 측정치를 "과거 측정이라 쓰지 않았다"고 명시하는 선례가 있음)를 이 자리에서만 놓친다.
  - 제안: item 1 의 diff 에 R-CC-22 문단의 "10개를 정확히" 문구에 각주 또는 갱신
    ("11개, +1은 `dto/responses/` 로 이동한 응답 DTO — §7 참조" 등)을 함께 붙인다. 엄밀히는
    같은 파일 내부 정합(self-consistency)에 가깝지만, item 1 이 바로 그 수치의 근거였던
    glob 을 건드리므로 이 배치 안에서 같이 잡지 않으면 다음 사람이 R-CC-22 를 근거로 "정확히
    10개" 라는 잘못된 전제를 재사용하게 된다.

## 교차 검증 결과 (충돌 없음 확인)

아래는 각 item 이 인접/참조 spec 과 실제로 어긋나지 않는지 대조한 결과다 (모두 정합 확인):

1. **item 1 (glob)** — 형제 문서 `spec/2-navigation/2-trigger-list.md` 의 `code:` 는 이미
   `codebase/backend/src/modules/triggers/dto/**` (더 넓은 glob)를 갖고 있어 두 spec 이 같은
   파일을 중복 소유하는 것은 이 저장소의 기존 관례("glob 이 self-spec 까지 무는 것은 의도")와
   일치. 신규 충돌 아님.
2. **item 2 (§7 파일 트리)** — `15-chat-channel.md` 513~550행의 현재 트리에
   `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 행이 실제로 없고,
   `chat-channel-input-rules.ts` 설명도 draft 가 지적한 그대로("입력 검증·변환 순수 함수")임을
   확인. 코드 쪽 `chat-channel-input-rules.ts:34` 주석("입력만 있는 파일이 아니다")과
   `translateSetupChannelError`(329행) 존재도 확인 — 서술 변경이 사실과 일치.
3. **item 3 (swagger.md §5-1)** — 현재 §5-1(417행) "이름 충돌을 피합니다" 문단은 `.literal.ts`
   상수 전용 서술이고 응답 DTO 클래스명 유일성 규칙은 어디에도 없음(확인). frontmatter `code:`
   에도 `dto-class-name-collision*.ts` 부재 확인. 코드 가드
   (`dto-class-name-collision.spec.ts`/`-guard.ts`, `fixtures/dto-class-collision/`)는 실재.
   draft 가 인용하는 예시 클래스 `ChatChannelBotIdentityDto`
   (`dto/chat-channel-config.dto.ts:149`) / `ChatChannelRotateBotIdentityDto`
   (`dto/responses/chat-channel-rotate-bot-token-response.dto.ts:35`)도 실재 — 추가만 있고
   기존 규약과 모순 없음.
4. **item 4 (chat-channel-adapter.md §1.1.2 다의성 표)** — diff base(169~177행) 정확히 일치.
   "네 번째 뜻"(Node/undici 시스템 에러)은 이미 `codebase/.../chat-channel/types.ts:512-524` 의
   `isCredentialRejectedError` 주석이 화이트리스트 정확 일치로 코드 구현까지 마쳤음을 확인 —
   spec 이 이미 존재하는 구현/타 파일 주석을 뒤늦게 반영하는 것이라 모순 없음.
   `grep "세 뜻|네 뜻"` 은 `chat-channel-adapter.md` 1개 파일에서만 나와 다른 spec 이 "세 뜻"을
   전제로 인용하는 곳도 없음(동기화 대상 없음).
5. **item 5 (slack.md §3.1 5값 확정)** — 코드 상수
   `SLACK_CREDENTIAL_REJECTED_ERRORS`(`slack.adapter.ts:54-60`)가 정확히
   `invalid_auth`/`not_authed`/`account_inactive`/`token_revoked`/`token_expired` 5값이고
   diff base 도 현재 문서와 일치.
6. **item 6 (2-api-convention.md §7 신규 행)** — `15-chat-channel.md` CCH-NF-03(115행, 분당 60건
   기본·1–600 override·202+ignored·fail-open)과 `data-flow/14-chat-channel.md`(89~94행,
   206행 `cc:rl:{triggerId}:{conversationKey}` Redis 키)가 draft 의 제안 행과 수치·정책 모두
   일치. 기존 §7 의 다른 행들(EIA inbound·SSE·WS 명령)과 형식도 동일 — 신규 행이되 모순 없음.
   §6 HTTP 상태 코드 표(355행)에 `CHAT_CHANNEL_SETUP_FAILED`/502 행이 **이미** 등재돼 있어
   (R-CC-23 이 요구한 별개 후속) 이것과 item 6(§7 rate limit)·item 7(§1.12 에러 카탈로그)이
   서로 다른 표를 채우는 것으로 확인 — 중복 기재 아님.
7. **item 7 (3-error-handling.md §1.12 신설)** — 6개 코드
   (`INVALID_BOT_TOKEN`/`CHAT_CHANNEL_NOT_CONFIGURED`/`CHAT_CHANNEL_PROVIDER_UNKNOWN`/
   `CHAT_CHANNEL_ENDPOINT_REQUIRED`/`BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`) 모두
   `15-chat-channel.md §5.4`(354~369행)의 SoT 표와 status·설명이 1:1 일치. 저장소 전체에서
   이 6개 코드를 언급하는 파일은 `2-trigger-list.md`·`slack.md`·`discord.md`·
   `2-api-convention.md`·`15-chat-channel.md`·`chat-channel-adapter.md`·
   `data-flow/14-chat-channel.md` 뿐이며 상충 정의 없음. §1.10/§1.11 의 표 형식·문구 패턴과도
   동일해 신설 절 삽입 위치(§1.11 뒤)가 번호·구조상 안전.
8. **item 8 (§3.x 중복 — 구조 변경 기각)** — 실측대로 Overview 의 `#### 3.1~3.6`(52~109행,
   CCH-* 요구사항)과 본문 `### 3.1~3.3`(121~195행, 처리 흐름)이 실제로 공존함을 확인. 두 헤더의
   제목이 달라 앵커 슬러그는 충돌하지 않음(예: `#31-어댑터-라이프사이클` vs `#31-전체-시퀀스-telegram-예시`).
   구조 변경 대신 인용 규칙만 못박는 처방은 다른 spec 의 상태 머신·API 계약을 건드리지 않아
   cross-spec 리스크 없음.
9. **item 9 (R-CC-23 완료 주석)** — 943행의 "구현 정정은 developer 후속이다." 원문 확인.
   취소선 정정 방식(원문 보존 + 완료 각주)은 이 문서의 다른 자리(R-CC-21 "기각한 대안" 등)와
   동일 톤 — 이질감 없음.

## 요약

7개 변경안 모두 diff base 가 현재 spec 원문·코드 실체와 라인 단위로 정확히 일치했고,
target 이 참조하는 형제 spec(`2-trigger-list.md`·`slack.md`·`discord.md`·
`data-flow/14-chat-channel.md`·`2-api-convention.md` §6)과도 수치·정책·에러 코드 정의가
모두 합치했다. 새 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임을 새로 정의하는
항목이 없고 전부 "이미 구현·결정된 사실을 문서에 반영"하는 성격이라 cross-spec 충돌 표면
자체가 작다. 유일한 흠은 item 1 이 넓히는 glob 이 같은 파일의 R-CC-22 Rationale 이 못박은
정량 주장("10개를 정확히")을 stale 하게 만드는데 이 배치가 그 수치를 함께 갱신하지 않는다는
점 — CRITICAL 은 아니지만 이 배치가 스스로 세운 "실측 근거는 갈릴 때마다 갱신한다" 원칙에
어긋나므로 반영을 권한다.

## 위험도

LOW
