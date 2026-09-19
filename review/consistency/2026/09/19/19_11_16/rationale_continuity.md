# Rationale 연속성 검토 — spec/2-navigation/ (webhook endpoint reservation, impl-prep)

## 범위와 방법

target 은 `spec/2-navigation/`(주로 `2-trigger-list.md` · `1-workflow-list.md` · `3-schedule.md` 전문 포함, 나머지 15개는
예산 절단으로 헤더만) 이며, 이번 착수 대상은 planner 커밋 `c8dd613e0`(2026-09-19)이 이미 반영한 **"지우거나 바꾼 웹훅
경로의 영구 예약"** 기능이다. 대조 대상은 번들에 포함된 관련 spec 의 `## Rationale` 발췌
(`1-data-model.md` · `5-system/3-error-handling.md` · `5-system/12-webhook.md` · `data-flow/10-triggers.md` ·
`7-channel-web-chat/5-admin-console.md` · `0-overview.md` · `3-workflow-editor/*.md`)와, `2-trigger-list.md` /
`1-workflow-list.md` / `3-schedule.md` 자신의 `## Rationale`(R-1~R-17, §1~§4) 이다.

주의: `5-system/1-auth.md` · `5-system/2-api-convention.md` · `4-nodes/7-trigger/providers/*.md` 등 15+57개 파일은
컨텍스트 예산으로 본문이 절단돼 이 리뷰에 포함되지 않았다 — "여기 없다"를 "문제 없다"의 근거로 쓰지 않았다.

## 발견사항

검토 결과 target(`2-trigger-list.md` 등)이 기존 Rationale 에서 명시적으로 기각한 대안을 재도입하거나, 합의된 설계
원칙을 위반하거나, 근거 없이 과거 결정을 번복한 지점은 **발견하지 못했다**. 아래는 CRITICAL/WARNING 이 아니라
정합성 보강 관점의 INFO 두 건이다.

- **[INFO]** 삭제 확인 다이얼로그가 "영구 예약" 결과를 사용자에게 알리지 않음
  - target 위치: `spec/2-navigation/2-trigger-list.md` §4.2 확인 다이얼로그, `webhook` 행 (`"이 트리거를 삭제하면
    {url} 로 들어오는 모든 호출이 즉시 404 가 됩니다."`)
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → "지운 · 바꾼 웹훅 경로의 영구 예약 (2026-09-19)" — 결정:
    "지우거나 바꾼 경로는 다른 워크스페이스가 영원히 쓸 수 없고, 같은 워크스페이스는 다시 쓸 수 있다."
  - 상세: 이 Rationale 은 "**응답을 구분하지 않는 이유**"에서 "예약됨"을 API 응답에 노출하지 않기로 명시적으로
    결정했다(제3자에게 경로 사용 이력이 새는 것을 막기 위해). 이는 *제3자에게* 새지 않게 하는 결정이지,
    *삭제를 실행하는 소유자 본인*에게 "이 경로는 삭제해도 당신 워크스페이스 소유로 영구 예약되며 다른
    워크스페이스는 재사용할 수 없다"를 알리는 것과는 다른 축이다. 현재 §4.2 문구는 "즉시 404"만 언급해
    영구 예약이라는 새 사실을 사용자가 인지할 경로가 없다. 이는 Rationale 위반이 아니라 **미반영 여지**다 —
    Rationale 이 "하지 않은 것"으로 명시한 것도 "예약 해제 운영 기능"뿐, UI 고지 여부는 언급하지 않는다.
  - 제안: 필수는 아니나, §4.2 `webhook` 행 문구에 "이 경로는 다시 등록할 수 있지만(같은 워크스페이스), 다른
    워크스페이스는 사용할 수 없습니다" 류 고지를 추가하면 사용자 기대와 실제 동작(§2.3.1 `endpointPath` 행의
    409 조건)이 더 잘 맞물린다. 추가하지 않기로 한다면 그 결정도 §4.2 인접에 짧게 근거를 남기는 편이 다음
    검토자의 재지적을 막는다.

- **[INFO]** `endpointPath` 변경 경고 문구가 새 예약 규칙을 반영하지 않음
  - target 위치: `spec/5-system/12-webhook.md` `## Rationale` → "endpointPath 가변성" 절이 인용하는
    `triggers.detail.endpointPathChangeWarning`("변경 시 기존 URL 은 404")와, 그 문구를 그대로 재인용하는
    `spec/2-navigation/2-trigger-list.md` §2.3.1 `endpointPath` 행
  - 과거 결정 출처: 동일 — `1-data-model.md` §2.8.1 WebhookEndpointReservation 결정
  - 상세: `endpointPath` 를 바꾸면 옛 경로가 "삭제"와 동일하게 그 워크스페이스 소유로 영구 예약된다(같은
    Rationale 문서, "사용 시점 예약" 절 — 생성·경로 변경이 쓰기 지점 둘). 삭제 확인 다이얼로그와 마찬가지로
    변경 경고 문구도 "기존 URL 은 404" 까지만 말하고 "영구 예약" 사실은 담지 않는다. 두 UI 표면(삭제 확인,
    경로 변경 경고)이 대칭적으로 같은 정보 격차를 갖고 있어 하나로 묶어 처리할 수 있다.
  - 제안: 위 항목과 동일한 처리 — 문구 보강 또는 "왜 보강하지 않는지"를 Rationale 에 짧게 남긴다.

## 확인했으나 문제 없음으로 판정한 항목 (기록용)

- `2-trigger-list.md` §2.3.1/§3 의 `endpointPath` 409 서술(`TRIGGER_ENDPOINT_PATH_CONFLICT`, 세부 코드 미분기)은
  `1-data-model.md` Rationale 의 "응답을 구분하지 않는 이유"(동일 409·동일 세부 코드)와 정확히 일치한다 — 신설
  기능이 그 결정을 올바르게 인용하고 있다.
  - **[CONFIRM]** 응답 코드 구분 안 함 정합성 확인
- 예약이 "삭제 시점 묘비"가 아니라 "사용 시점(생성·경로 변경)"에 쓰인다는 결정과, `2-trigger-list.md` §4.3
  cascade 표가 트리거/워크플로/워크스페이스 삭제 시 예약 관련 특별 처리를 언급하지 않는 것은 모순이 아니다 —
  Rationale 이 "예약은 삭제 전부터 이미 있어 그 경합이 생기지 않는다"고 명시했으므로 삭제 경로에 추가 서술이
  필요 없다.
- `WH-SC-01`(고엔트로피 UUID 는 추측을 막을 뿐 복사를 막지 못한다는 새 인식)과 `R-15`(무인증 webhook 경고 — URL
  을 아는 누구나 실행 가능)는 서로 다른 위협 모델을 다루며 상충하지 않는다. R-15 는 "인증 없음"이 지원되는
  옵션이라는 기존 결정을 그대로 유지한 채 가시성만 더하는 결정이고, 새 예약 기능은 "경로를 아는 사람이 다른
  워크스페이스에 등록"하는 별개 위협을 막는다 — 서로 다른 층을 겨냥해 중복도 충돌도 없다.
- 트리거 단위 advisory lock(§3 "동시 쓰기 직렬화")과 새 DB 트리거 기반 전역 예약 제약은 각각 앱 레벨 직렬화와
  DB 레벨 무결성으로 계층이 다르며, 데이터모델 Rationale 이 "DB 트리거인 이유"에서 "동시 요청 경합을 DB 가
  막지 못한다"는 이유로 앱 레벨 검사를 이미 기각했으므로 두 메커니즘의 공존은 의도된 설계다.
- 마이그레이션 백필이 "재등록 없는 경로 변경"을 흉내 내지 않고 NOTICE 로만 알린다는 결정([R-CC-21] 기각 대안
  회피)은 마이그레이션(SQL, 1회성)에 한정된 것으로, 런타임 app-level `endpointPath` PATCH 흐름(항상 mutable,
  이미 확립된 "endpointPath 가변성" 원칙)과는 다른 트랙이라 재도입 문제가 아니다.
- `1-workflow-list.md`(§1 공유 정의·§2 import permissive·§3 폴더 깊이·§4 태그 필터 단일)와 `3-schedule.md`(sort/order
  표기 해제·schedule 생성 제약·딥링크 비대칭)는 각각 자신의 본문이 자신의 Rationale 과 정합했다 — 재도입/번복
  없음.

## 요약

이번 착수 대상(웹훅 엔드포인트 영구 예약)에 대해 planner 가 이미 반영한 spec 변경(`c8dd613e0`)은 관련 spec 들의
기존 Rationale — 특히 `1-data-model.md` 의 신설 Rationale 자체, `5-system/12-webhook.md` 의 "endpointPath 가변성",
`data-flow/10-triggers.md` 의 UNIQUE 범위 절 — 과 표현이 정확히 일치하며, 기각된 대안(기간제 묘비·앱 레벨 검사·응답
구분·예약 해제 기능)을 재도입하는 곳도, `2-navigation` 자신의 R-1~R-17/§1~§4 원칙을 어기는 곳도 찾지 못했다.
남은 것은 사용자 대상 UI 고지 문구(삭제 확인·경로 변경 경고)가 새 "영구 예약" 사실을 담지 않는다는 INFO 2건뿐이며,
이는 Rationale 위반이 아니라 보강 제안이다. 다만 예산 절단으로 15+57개 관련 파일 본문(특히 `5-system/1-auth.md` ·
`5-system/2-api-convention.md` · trigger provider 문서)을 직접 대조하지 못했으므로, 그 파일들에 이번 기능과 상충하는
서술이 없는지는 이 리뷰만으로는 배제할 수 없다.

## 위험도

LOW
