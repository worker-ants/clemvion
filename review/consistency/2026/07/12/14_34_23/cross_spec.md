> **복구본**: 원 sub-agent 의 disk write 가 harness 에 의해 유실됨(disk-write gap). 아래는 workflow journal.jsonl 의 반환값에서 그대로 복구한 전문이다(main Claude 재집계).

### 발견사항

- **[WARNING]** `wc:boot` 재전송으로 `locale` 을 갱신할 수 있다는 기존 SDK 계약이 draft 의 "boot 1회 해석·전역 고정" 설계와 충돌
  - target 위치: §3.1 "언어는 boot 시 1회 해석(§3.2)해 위젯 전역에 고정. 런타임 토글은 이번 범위 밖" / §4 Edit D (`5-admin-console.md §6.1` step5 를 "locale 변경 시 재마운트로 새 언어 적용" 으로 수정)
  - 충돌 대상: `spec/7-channel-web-chat/2-sdk.md` §3 "`wc:boot` 재전송(멱등 재설정)" 문단 (line 106-109) — "host 는 iframe 을 재생성하지 않고 `wc:boot` 을 다시 보내 boot config(**외형·locale·콘텐츠**)를 갱신할 수 있다"
  - 상세: 현재 `2-sdk.md §3` 은 (locale 이 inert 이던 시절 작성돼) "locale" 도 단순 `wc:boot` 재전송만으로 갱신 가능한 필드로 열거한다. 그런데 target §3.1 의 신규 메커니즘은 locale 을 "boot 시 1회 해석 후 위젯 전역에 고정, 런타임 토글 비목표" 로 설계한다. 이는 `5-admin-console.md` 가 이미 실제로는 **locale 변경 시엔 재마운트**(iframe key 교체)를 요구하는 것과도 일치하는 설계이지만 — 정작 target 의 Edit B 범위(`2-sdk.md §4` 스키마 주석·산문 note, `§R6`)는 이 `§3` 문단을 건드리지 않는다. locale 이 활성화되면 `§3` 의 "재전송만으로 locale 갱신 가능" 서술은 **일반 host(운영 콘솔이 아닌 임의 고객 사이트) 기준으로 사실이 아니게 된다** — resolveLocale 이 boot 1회만 실행되므로 remount 없는 재전송은 문구 그대로는 언어를 바꾸지 못한다. 즉 동일 `wc:boot` 프로토콜에 대해 `2-sdk.md`(범용 SDK 계약, 미수정) 와 `1-widget-app.md`/`5-admin-console.md`(target 신규 서술) 가 서로 다른 상태 갱신 규칙을 기술하게 된다.
  - 제안: Edit B 범위에 `2-sdk.md §3` "wc:boot 재전송" 문단을 포함시켜, locale 을 "재전송만으로 갱신되는 필드" 목록에서 제외하거나 "locale 변경은 재전송만으로 반영되지 않으며 iframe 재마운트가 필요하다" 는 제약을 명시적으로 추가한다(Edit D 가 admin 콘솔 한정으로 이미 서술하는 내용을 SDK 범용 계약으로 일반화).

- **[WARNING]** `spec/0-overview.md §6.1` 의 "영역 종결" 서술이 이번 활성화(신규 실행 마일스톤)와 상충하며 `spec_impact` 에 누락
  - target 위치: frontmatter `spec_impact` (5개 파일) / §8 "후속(구현 핸드오프)" — "spec 확정 후 `developer` 구현", "메커니즘 + EN 전문 동반... 다음 빌드 단위"
  - 충돌 대상: `spec/0-overview.md §6.1` "임베드형 웹채팅 위젯 + SDK" 행 — "영역 spec 6문서 전부 `implemented`(**영역 종결**). **잔여 품질·하드닝 항목은 비차단 backlog 로 분리.**"
  - 상세: target 의 마일스톤은 §922 defer 를 해제해 EN chrome 번역이라는 **신규 기능 작업**을 여는 것이며, 스스로 "비차단 backlog" 가 아니라 "다음 빌드 단위" 로 규정한다. 그러나 `0-overview.md §6.1` 은 이 영역을 이미 "종결"로 선언하고 잔여 항목은 전부 "비차단 backlog" 라고 단정한다. draft 5개 파일이 merge 되는 즉시(코드 구현 전) 이 root 레벨 요약과 영역 spec 본문 사이에 실질적 모순이 생긴다 — `spec-impl-evidence.md §3` 의 `status: implemented`/`partial`/`spec-only` 라이프사이클 관점에서도, 새로 서술되는 i18n 메커니즘은 아직 코드가 없는 채로 `implemented` 프론트매터를 유지하게 된다(`code:` glob 이 기존 파일에 매치돼 가드는 통과하지만, 문서상 "완결" 주장은 정확하지 않다).
  - 제안: `spec_impact` 에 `spec/0-overview.md` 를 추가하고 §6.1 웹채팅 행을 "EN chrome i18n 착수(활성화, 신규 마일스톤)" 로 갱신하거나, 구현 완료 전까지 해당 서술을 §6.2(부분 구현)로 임시 이동하는 것을 검토한다.

- **[INFO]** 별도 로케일 해석 메커니즘과의 명명 유사성(문제는 아님)
  - target 위치: §3.2 `resolveLocale()` 우선순위 (explicit → auto-detect → ko)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §4.1 `config.chatChannel.languageLocale` (override → locale default → ko fallback)
  - 상세: 서로 다른 제품 표면(위젯 client-side vs Chat Channel server-side 어댑터)에 대해 유사한 "explicit override → 기본값 → ko fallback" 패턴이 독립적으로 존재한다. 실제 모순은 아니며 오히려 기존 선례와 정합적이지만, 필드명(`BootConfig.locale` vs `config.chatChannel.languageLocale`)과 개념(위젯 UI 언어 vs 서버 발신 메시지 언어)이 다르다는 점을 spec 독자가 혼동하지 않도록, Edit B/C 본문에서 "이 `locale` 은 위젯 UI 렌더 언어이며 Chat Channel 의 `languageLocale`(서버측 알림 문구)와는 별개 개념" 정도의 한 줄 구분을 넣으면 향후 grep 기반 탐색 시 혼동을 줄일 수 있다.

### 요약

target draft 는 `plan/complete/webchat-i18n-scope.md` 가 실제로 defer 하고 spec(`2-sdk §R6`, `_product-overview §2`, `i18n-userguide 적용 범위`)이 명시적으로 예약해 둔 활성화 경로를 그대로 밟고 있어 rationale-continuity 상 문제가 없고, "위젯 EN 다국어화 비목표"/"Korean-only"/"locale reserved" 를 언급하는 4개 spec 파일(`_product-overview.md`, `2-sdk.md`, `5-admin-console.md`, `i18n-userguide.md`) 전체를 빠짐없이 Edit 목록에 포함해 dangling 참조를 남기지 않는다. requirement ID 스킴(§번호+R#, WCA-* 미존재)·데이터 모델(신규 엔티티·컬럼 없음, 기존 JSONB `appearance.locale` 재사용)·RBAC·레이어 경계(위젯 별도 정적 번들 vs 메인 앱 dict, `0-architecture.md` 의 iframe 격리 원칙)와도 모순이 없다. 다만 (1) `wc:boot` 재전송으로 locale 을 갱신할 수 있다는 기존 `2-sdk.md §3` 서술이 draft 의 "boot 1회 해석·전역 고정" 설계와 충돌하는 지점을 Edit B 범위가 놓치고 있고, (2) `0-overview.md §6.1` 의 "영역 종결/비차단 backlog" 서술이 이번에 여는 신규 실행 마일스톤과 상충하는데 `spec_impact` 에서 빠져 있다 — 둘 다 CRITICAL 수준의 즉시 파손은 아니지만 명시적 처리가 필요한 WARNING이다.

### 위험도
MEDIUM
