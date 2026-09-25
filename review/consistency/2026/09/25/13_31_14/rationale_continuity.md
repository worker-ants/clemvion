# Rationale 연속성 검토 — `plan/in-progress/changelog-backfill-12.md`

## 검토 범위와 방법

target 은 트래커 항목(`plan/complete/changelog-criteria.md` §B "나머지 미동반 후보는 이 PR 에서 백필하지 않는다")이
지정한 **12건 PR 을 CHANGELOG 기준으로 재판정**하는 plan draft다. 새 설계·API 계약을 제안하는 문서가 아니라
**이미 merge 된 과거 결정들의 사실 관계를 CHANGELOG 등재 여부 판정에 활용**하는 문서이므로, Rationale 연속성 검토의
초점은 (a) target 이 인용하는 각 PR 의 기술적 서술이 해당 영역의 spec Rationale 과 어긋나지 않는가, (b) target 이
Section B 에서 CHANGELOG 판정 기준 ①을 확장하는 것이 그 기준을 만든 `changelog-criteria.md` 의 결정과 상충하지 않는가
두 가지였다.

번들이 컨텍스트 예산으로 78개 spec 파일(§본문)을 절단했는데, 그중 `spec/4-nodes/4-integration/*.md`(SSRF) ·
`spec/5-system/6-websocket-protocol.md`(WS 타이머) · `spec/5-system/15-chat-channel.md`(rotate-bot-token) ·
`spec/5-system/2-api-convention.md` / `spec/conventions/swagger.md`(OpenAPI `additionalProperties`) 는 target 이 판정
근거로 인용하는 PR 들과 정확히 겹친다. 번들에 없다는 사실만으로 "문제 없음" 판정을 내리지 않기 위해, 위 파일들을
직접 `Read`/`grep` 으로 열어 대조했다(아래 상세).

## 대조 결과 — 상충 없음

1. **`#1206`/`#1326` (OpenAPI 계약 광고)** — target Section B 는 "런타임 응답 불변 + OpenAPI 계약 변화" 를 기준 ①에
   넣자고 제안한다. `spec/5-system/2-api-convention.md:38` 이 이미 "OpenAPI 문서가 실제 wire 와 어긋나면 그 어긋남이
   소비자 코드로 전파된다" 는 동일 원칙을 명시하고 있어 target 의 확장 근거와 **정합**한다.
   `spec/conventions/swagger.md` §1-4(닫힌 union 을 `additionalProperties` 로 뭉개지 않는다)를 놓고 `#1206` 이 그
   금지된 패턴("닫힌 union → 열린 map")을 재도입한 것이 아닌지 확인했으나, 실제 커밋(`e5ba923ca`)은 `inputOverride`
   가 이미 "열린/동적 map" 으로 설계된 필드의 축약 데코레이터가 `additionalProperties` 를 누락해 생성기가 빈
   인터페이스로 오인하던 것을 고친 것이다 — §1-4 가 승인하는 예외(런타임 결정 키 집합)에 해당하고 금지 패턴과 무관.
2. **`#1354`/`#1358` (entity-schema e2e 가드)** — `spec/1-data-model.md` Rationale "`code:` 에 전용 e2e 가드 셋
   (2026-09-19)" 이 "인덱스·제약은 선언→DB 한쪽, 컬럼 정의는 양방향" 이라 명시한 것과 target 의 서술(`#1354`=선언↔DB
   대조 신설, `#1358`=컬럼 층 양방향 강화)이 정확히 일치한다.
3. **`#1364` (SSRF 가드 소비자)** — target 이 "판정 아닌 오류를 차단으로 보고하지 않는다" · "오늘은 도달 경로가 없다"
   고 적은 내용은 실제 spec(`spec/4-nodes/4-integration/0-common.md:85`, `2-database-query.md:344`,
   `1-http-request.md:98,127`)에 "SSRF 가드가 차단 판정이 아닌 오류를 던진 경우(가드 자체의 고장)도
   `INTEGRATION_CALL_FAILED` 로 surface" 로 이미 문서화돼 있다(후속 `#1367` 이 이 문서 동기화를 별도로 수행) — 새로
   지어낸 서술이 아니라 기존 Rationale 그대로다.
4. **`#1270` (WS 토큰 타이머 `.unref()`)** — `spec/5-system/6-websocket-protocol.md:1175` 가 "access token 수명은
   900초" 를 이미 SoT 로 갖고 있어 target 의 "최대 토큰 수명(900초)만큼 늦어질 수 있었다" 서술과 부합한다. 이 PR 은
   그 기존 설계를 뒤집지 않고 셧다운 시 event loop 점유라는 별개의 운영 결함만 고친다.
5. **`#1326` (`rotate-bot-token` OpenAPI)** — `spec/5-system/15-chat-channel.md` R-CC-10 (bot token 변경 single-path)
   결정을 그대로 두고 기존 엔드포인트에 OpenAPI 데코레이터만 얹는 것으로, target 서술("런타임 응답 불변")이
   R-CC-10 의 single-path 결정을 재론·우회하지 않는다.

## Section B — 기준 ① 확장에 대한 검토

target 은 `changelog-criteria.md` 가 확정한 기준 ①("API 응답 · 에러 코드 · 감사 기록의 변화")에 "OpenAPI 로 광고하는
계약" 을 보태자고 제안한다. 이는:

- `changelog-criteria.md` §B 가 스스로 "12건은 기준으로 하나씩 재판정해야 한다" 고 예고한 절차를 그대로 수행하는
  것이고, 그 문서 어디에도 기준 ①을 "런타임 응답 변화로만" 고정한다는 명시적 배타 조항이 없다.
  (§B 원문은 "API 응답 · 에러 코드 · 감사 기록의 변화" 라고만 적어 열거 예시였지 닫힌 목록으로 못박지 않았다.)
- target 스스로 "적용이 기준을 좁히거나 넓히는 자리를 조용히 판단으로 메우지 않는다" 고 명시해, 이 변경이 새
  Rationale 없이 이뤄지는 **무근거 번복이 아니라 명시적으로 밝힌 보강**이라는 점을 문서 안에 남긴다 — 검토 관점 3
  ("결정의 무근거 번복")이 요구하는 최소 요건을 충족한다.
- CHANGELOG.md 상단에 기준을 두기로 한 `changelog-criteria.md` §B 결정("판정은 이 파일을 고치는 순간 필요")과도
  어긋나지 않는다 — target 이 편집 대상으로 잡은 위치(CHANGELOG.md 상단 기준 블록)가 그 결정과 일치한다.

## 발견사항

없음 — CRITICAL·WARNING 대상 발견 없음.

- **[INFO] 번들 절단 구간을 직접 원본 대조로 메웠음을 plan/리뷰 기록에 남겨두면 좋다**
  - target 위치: `plan/in-progress/changelog-backfill-12.md` 전체(spec_impact: none)
  - 과거 결정 출처: 해당 없음 (프로세스 관찰)
  - 상세: 이번 `--plan` 번들이 SSRF·WS·chat-channel·OpenAPI 관련 spec 본문 78개를 컨텍스트 예산으로 절단했다. 이
    checker 는 그 파일들을 직접 열어 target 의 기술적 주장과 대조했고 상충을 찾지 못했으나, 이 대조가 이 세션의
    checker 산출물에만 남고 target plan 자체에는 흔적이 없다.
  - 제안: 필수는 아니나, `changelog-backfill-12.md` §C 검증 체크리스트에 "spec 원문 대조(번들 절단분 포함)" 한 줄을
    남기면 다음 세션이 같은 대조를 반복하지 않아도 된다.

## 요약

target 은 새 설계를 제안하는 문서가 아니라 이미 merge·리뷰를 거친 12개 PR 을 확정된 CHANGELOG 기준으로 재분류하는
문서이며, 인용하는 기술적 사실(SSRF 가드 에러 코드 분리, entity-schema e2e 가드의 방향성, WS 토큰 900초 수명,
OpenAPI 계약과 wire 어긋남의 전파, chat-channel bot-token single-path 불변)은 모두 해당 영역 spec 의 기존 Rationale
과 정확히 일치했다(다수는 번들에서 예산 절단됐으나 원문을 직접 열어 대조함). Section B 의 기준 ① 확장도 그 판단이
왜 필요한지와 그것이 "조용한 판단으로 메우지 않는다" 는 원칙 준수를 스스로 명시해, 무근거 번복이 아니라 명시적
보강으로 기록된다. 기각된 대안의 재도입·합의 원칙 위반·암묵적 invariant 우회로 볼 만한 지점을 찾지 못했다.

## 위험도
NONE
