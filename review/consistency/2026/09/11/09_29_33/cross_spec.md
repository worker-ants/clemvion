# Cross-Spec 일관성 검토 — `spec-draft-chat-channel-conventions.md`

## 검토 방법 안내

전달된 `_prompts/cross_spec.md` 번들은 `spec/5-system/2-api-convention.md`·`spec/5-system/15-chat-channel.md`·
`spec/1-data-model.md` 등 판정에 필요한 대다수 관련 spec 본문이 "컨텍스트 예산 초과로 절단" 상태였다
(기존에 알려진 `--spec` 모드 예산 갭). 이 검토는 번들 대신 워크트리의 실제 파일을 직접 읽어 대조했다 —
`spec/5-system/2-api-convention.md` · `spec/5-system/3-error-handling.md` · `spec/5-system/15-chat-channel.md`
· `spec/5-system/1-auth.md §4.1` · `spec/1-data-model.md §2.18` · `spec/conventions/swagger.md` ·
`spec/conventions/chat-channel-adapter.md` · `spec/conventions/error-codes.md` · `spec/conventions/audit-actions.md`
· `spec/conventions/secret-store.md` · `spec/conventions/node-output.md` · `spec/data-flow/1-audit.md` ·
`spec/data-flow/14-chat-channel.md` · `spec/2-navigation/2-trigger-list.md` · 관련 코드
(`triggers.service.ts`·`workspaces.service.ts`·`chat-channel-config.dto.ts` 등) 및 직전 라운드 산출물
(`review/consistency/2026/09/11/09_03_56/*.md`).

이 target 은 그 직전 라운드(`09_03_56`)의 지적에 대한 **개정판**이다 — 아래는 그 라운드의 CRITICAL/WARNING
이 이번 판에서 실제로 해소됐는지를 중심으로 재검증했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 직전 라운드 대비 변경점의 검증 결과와 사소한 INFO 다.

- **[INFO]** 변경안 `5a` 의 "3축 표" 라는 지시어가 문서 안에서 정의되지 않은 축약 표현이다
  - target 위치: `## 변경안` 표 `5a` 행 — `15-chat-channel.md §5.4.1 3축 표 details[].code 칸`
  - 충돌 대상: 없음(모순은 아님) — `spec/5-system/15-chat-channel.md §5.4.1`
  - 상세: "3축 표"라는 명칭의 테이블은 `15-chat-channel.md` 안에 문자 그대로 존재하지 않는다.
    실측 결과 이 지시어는 §5.4.1 표의 "토큰 변경 (rotation)" 행 — `details.field` 가 값 형태에 따라
    (중첩 경로/flat) · (배열/객체) · (`code` 유무) 세 축으로 갈리는 그 셀 — 을 가리키는 것으로
    보인다(직전 커밋 `f947b49f4` 커밋 메시지의 "details.field 세 축" 표현과 일치). 셀 자체는
    정확히 특정되고 5b(`§5.4.1.1 회전 행`)·5c(`§5.4.1.2 닫는 문장`)와 겹치지 않게 구분돼 있어
    실제 편집 착오로 이어질 위험은 낮지만, 문서 밖 커밋 메시지에 의존하는 지시어라 실행자가
    아닌 제3자가 diff 만 보고 대상을 특정하기 약간 어렵다.
  - 제안: 실행 시 그 행에 앵커 텍스트("토큰 변경 (rotation)" 행)를 한 번 더 병기하면 좋다. 차단
    사유는 아니다.

## 검증해 확인한 것 (직전 라운드 CRITICAL/WARNING 재검증 — 해소 확인)

- **[前 CRITICAL — naming_collision] `D-1`/`D-2` 라벨 재사용**: 이번 판은 결정 라벨을 전면
  `CV-1`~`CV-4` 로 교체했다. `grep -rn "\bCV-[1-4]\b" spec/ plan/` 결과 `spec-draft-chat-channel-conventions.md`
  자신 외 다른 어떤 문서에도 `CV-1`~`CV-4` 가 없다 — 새 충돌 없음. 기존 `R-CC-21`의 `D-1`/`D-2`
  는 `triggers.service.ts`·`chat-channel-config.dto.ts`·`update-trigger.dto.ts`·`trigger-dto-validation.spec.ts`
  등 10곳 넘게 여전히 그 의미로 쓰이고 있음을 실측으로 재확인했다 — 라벨을 바꾼 판단이 맞다.

- **[前 CRITICAL — convention_compliance] "에러 응답 `details`" vs "감사 로그 `details`" 범주 오류**:
  이번 판 (a) 절의 "층 판정" 표가 HTTP 에러 봉투(`new *Exception({details})`) · 감사 로그
  (`auditLogsService.record`) · 노드 출력(`output.error.details`) 세 층을 명시적으로 분리했다.
  세 층이 실제로 **구조적으로 다른 필드**임을 직접 확인했다:
  - `AuditLog.details` 는 `spec/1-data-model.md §2.18` 이 `JSONB "변경 상세"` 로 정의하는
    별개 엔티티 컬럼이고, `spec/data-flow/1-audit.md` 의 액션별 실사용(`details.mode`·`details.field`·
    `details.from/to`·`details.method` 등)이 자유형임을 보여준다 — `field`+`code` 페어 구조를
    요구하는 곳이 없다.
  - `output.error.details` 는 `spec/conventions/node-output.md §3.2.2` 가 별도 SoT 를 가지며
    (`retryable`/`retryAfterSec`/노드별 필드), `field`/`code` 페어 스키마가 아니다.
  - `workspaces.service.ts:356,428` 의 `details: { field: 'name' }`/`{ field: 'settings' }` 는
    실측으로도 `recordAudit`/`auditLogsService.record` 호출부임을 재확인 — 감사 로그가 맞다.
  범주 오류는 해소됐고, CV-1 의 §5.3 개정 문면도 "감사 로그·노드 payload 는 범위 밖" 경계를
  명시하기로 결정했다 — 경계 판단 자체가 옳다.

- **[前 WARNING/CRITICAL(다른 checker) — §5.4.1.2 vs 신규 규칙 정면 충돌]**: `15-chat-channel.md
  §5.4.1.2` 를 직접 읽어 재확인 — "**top-level code 는 기존 `VALIDATION_ERROR` 재사용**이라 …
  신규 등재는 필요 없다. `details[].code` 는 두 항목 모두 **서비스 가드 갈래**라 싣지 않는다"
  라는 문장이 여전히 그대로 있다. 이는 CV-1(`field` 실으면 `code` 도 싣는다)과 문면 그대로
  모순된다 — 그러나 이번 판은 이 정확한 지점을 **CV-4 변경안 5c** 로 스코프에 명시적으로
  포함시켰고 (`15-chat-channel.md` 는 target 자신의 `spec_impact` 안에 있다), "그 문장들은
  틀리지 않았다(실측) — 지우지 않고 계약값을 병기한다"는 처리 방침도 §5.4.1/§5.4.1.1/§5.4.1.2
  세 지점(5a/5b/5c) 모두에 일관되게 적용했다. §5.4.1.1 rotation 행(`inboundSigning`)도 동일한
  "`code` 없음(단위 테스트 실측)" 문구를 갖고 있어 5b 가 놓치지 않고 커버함을 확인했다. 세
  지점 외에 같은 파일 안에 `details[].code` 를 언급하는 네 번째 자리(§7 Rationale R-CC-15,
  `UNKNOWN_PLACEHOLDER` 사례)가 있으나 그 자리는 이미 `field`+`code: INVALID_FIELD` 를 함께
  신고 있어 CV-1 신규 규칙과 상충하지 않는다(변경 불요, 변경안 목록에 없는 것이 맞다).

- **[前 WARNING — `2-navigation/2-trigger-list.md` 가 `spec_impact` 밖]**: 이번 판은 "미러
  staleness 판정" 절을 신설해 이 문서를 **grep 전수 + 주어 확인**으로 재검토했다. 직접 재확인한
  결과 — `2-trigger-list.md` 안의 네 자리(§3 PATCH 註 `chatChannel`/`inboundSigningPlaintext`
  차단, `R-12`, frontmatter `code:` 주석)는 전부 **`details.field` 의 형식**(중첩/flat)이나
  `field` 값 자체를 주어로 서술하며, `details.code` 의 유무를 주장하는 문장이 없다. CV-1 이
  `code` 를 추가해도 이 네 문장은 계속 참이다 — `spec_impact` 미포함 판단은 근거가 있다. 같은
  기준으로 `spec/data-flow/14-chat-channel.md:152` 도 확인했다 — `400 VALIDATION_ERROR` 만
  언급하고 `details.code`/`details.field` 값 유무를 주장하지 않아 마찬가지로 stale 하지 않다
  (target 이 이 파일을 언급하지 않았으나 독립 확인 결과 문제 없음).

- **[前 INFO — swagger.md §5-4 체크리스트 미반영]**: 변경안 `3` 이 `§5-4` 체크리스트에
  "요청 DTO 명명 — `Update` 접두 범위 확인" 한 줄 추가를 명시적으로 포함시켰다 — 해소.

- **CV-2 (DTO 명명 범위) 실측 재확인**: `export class Update[A-Za-z]*Dto` 전수 검색 결과
  정확히 **18개**이며 전부 컨트롤러 top-level 요청 바디임을 재확인했다(`UpdateScopeDto` 포함,
  `integrations.controller.ts` 에서 top-level 사용). `Patch` 접두 클래스는 backend 전체에 **0건**.
  `ChatChannelUpdateConfigDto`/`ChatChannelUiMappingDto`/`ChatChannelBotIdentityDto`/
  `ChatChannelConfigDto` 네 클래스 모두 draft 의 분류(`<Domain><Role>Dto` nested 패턴)와
  일치한다. `spec/conventions/swagger.md` 에는 기존에 DTO 명명 규칙 자체가 없었다(§1-1~§1-6
  전수 확인, "Update"/"Patch"/"명명 규칙" 키워드 0건) — CV-2 신설이 기존 규칙과 충돌할 여지가
  없다.

- **CV-3 (`setupChannel` 멱등 각주) 정합성**: `chat-channel-adapter.md §1.1` 원문("yes — 같은
  config 재호출 OK")과 `15-chat-channel.md` 의 다른 3개 인용처(CCH-AD-02, R8, registry overwrite
  서술)·`4-nodes/7-trigger/providers/discord.md`(bulk overwrite 멱등성) 를 전수 확인했다 —
  전부 **레지스트리/등록 안전성** 의미로만 쓰이고 있고 "시크릿 값 불변"을 주장하는 곳이 없다.
  CV-3 의 각주는 기존 서술과 상충하지 않고, 오히려 암묵적으로 공유되던 해석을 명문화한다
  (telegram 이 매 호출 `secret_token` 을 재발급한다는 사실은 `providers/telegram.md §3.1` ·
  `15-chat-channel.md §5.4.1.1` 의 telegram 행이 이미 서술).

- **`INVALID_FIELD` 카탈로그 등재 여부**: `3-error-handling.md §2.1` 을 직접 읽어 확인 —
  `INVALID_FIELD` 는 이미 §2.1 기본 형식 예시·서술(`details[].code` 로 `"INVALID_FIELD"` 만
  방출)에 등재돼 있다. CV-1 이 "신규 등재 불요"라 적은 것은 정확하다.

- 신규 요구사항 ID 충돌·RBAC 모델 충돌·상태 전이 충돌·계층 책임 충돌 관점에서는 이번 판에서도
  추가로 발견된 것이 없다 — CV-1~CV-4 는 기존 `R-CC-10`/`R-CC-21`/`CCH-AD-02` 등을 인용만 하고
  신규 요구사항 ID 를 발행하지 않는다.

## 요약

이 target 은 직전 라운드(`09_03_56`)가 지적한 CRITICAL 2건(라벨 재사용 `D-1`/`D-2`, 실측 표의
에러 응답/감사 로그 범주 오류)과 WARNING/INFO 3건(§5.4.1.2 문면 충돌 방치, `2-trigger-list.md`
staleness 미점검, swagger 체크리스트 미반영)을 모두 겨냥해 개정됐다. 실제 spec 파일·코드를 직접
대조해 재검증한 결과 다섯 건 모두 해소 근거가 실측과 부합했다 — 라벨은 신규 네임스페이스(`CV-*`)로
교체돼 충돌이 없고, 세 층(에러 봉투/감사 로그/노드 출력) 분리가 데이터 모델·convention 문서 SoT 와
정합하며, §5.4.1/§5.4.1.1/§5.4.1.2 세 지점 모두 CV-4 변경안(5a/5b/5c)의 명시적 스코프 안에 있고,
`2-trigger-list.md` 의 네 인용처는 전부 `details.field`(code 아님)를 주어로 삼아 CV-1 이후에도
참으로 남으며, swagger 체크리스트 항목도 변경안에 포함됐다. 남은 것은 실행 편의를 위한 사소한
표기 명확화(INFO 1건)뿐이다.

## 위험도

LOW
