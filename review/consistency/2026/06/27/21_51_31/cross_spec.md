# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상: `spec/7-channel-web-chat/` 변경 diff (webchat-widget-refactor-ff484f 워크트리)

---

## 발견사항

### [INFO] `0-architecture.md` Rationale 번호 재매핑 — `5-admin-console.md` 안에 stale 내부 참조 2건 잔존
- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` §R4 본문 (line 267, 274)
- **충돌 대상**: `spec/7-channel-web-chat/0-architecture.md` Rationale 섹션 (변경 후 R5=이전 R8, R6 폐기)
- **상세**: 이번 diff 에서 `0-architecture.md` 의 Rationale 번호가 재매핑됐다 — R5(클라이언트 consumer) → R2, R6(신규 spec 영역) → R3, R7(단일 iframe) → R4, R8(정적 CDN 자산) → R5. `5-admin-console.md` 는 §R6·§R7·§R8 의 **cross-file 링크는 §R5 로 이미 수정**됐으나, **같은 파일 내 자기 참조** 2건이 여전히 구 번호를 가리킨다:
  - line 267: `"단 §R6 동봉으로 기본값이"` — `5-admin-console.md` 자체의 `### R6. 위젯 동봉(co-deploy)` 를 가리키므로 올바른 자기 참조이며 번호 재매핑 대상이 아니다. (혼동 원인: 0-architecture 의 구 R6 와 우연히 번호가 같은 5-admin-console 의 R6.)
  - line 274: `"실제 선행조건은 §R6 의 위젯 동봉(co-deploy) 하나다"` — 동일, 자기 파일의 R6 지칭으로 정상.
  
  결론: 이 두 참조는 `5-admin-console` 자체의 R6 를 가리키며 `0-architecture` 번호 변경과 무관하다. 혼동 소지는 있으나 실제 내용 충돌은 없다.
- **제안**: 독자 혼란 방지를 위해 line 267·274 의 `§R6` 표기 앞뒤에 "아래" 또는 "본 문서" 를 삽입하거나, anchor 링크(`#r6-위젯-동봉co-deploy--same-origin-미리보기`)로 명시하면 drift 오탐 방지에 유리하다.

---

### [INFO] `4-security.md` 에 신규 Rationale `R5` 추가 — 영역 내 다른 파일의 `R5` 와 번호 충돌 없음, 단 명명 체계 비일관
- **target 위치**: `spec/7-channel-web-chat/4-security.md` 신규 `### R5. iframe sandbox allow-same-origin`
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md` Rationale `### R5. 스니펫의 command-queue 스텁은 필수 전제` / `spec/7-channel-web-chat/1-widget-app.md` `### R5. show/hide 직교 2축`
- **상세**: `7-channel-web-chat` 영역 내 각 파일이 독립적으로 R1~Rn 번호를 매기는 규칙이므로 파일 간 R5 번호 중복은 기존 관례와 일치한다. 충돌 아님. 단 `4-security.md §R5` 의 부제목이 "(d) §R5 carve-out 과의 관계"에서 `0-architecture §R5` 를 인라인 참조하는데, 두 R5가 같은 번호라 독자가 순간 혼동할 수 있다.
- **제안**: INFO 수준 — 실제 동작에 영향 없음. 향후 spec 리팩터 시 파일 간 번호를 prefix(예: `arch-R5`)로 구분하면 drift 방지에 도움이 된다.

---

### [INFO] `spec/5-system/12-webhook.md` Rationale 추가 — `GET /api/hooks/:endpointPath/embed-config` 스코프 명확화
- **target 위치**: `spec/5-system/12-webhook.md` Rationale 말미 신규 단락 ("③의 POST 전용은 트리거 진입 엔드포인트에 한정")
- **충돌 대상**: `spec/5-system/12-webhook.md` 본문 `### R(webhook SoT 확정)` 의 기존 "③ POST 전용" 선언
- **상세**: 기존 webhook SoT 확정 항목 "③ POST 전용(GET/PUT·?wait 동기모드 미지원)"이 절대 규칙처럼 기술됐으나, `GET /api/hooks/:endpointPath/embed-config` 가 이미 구현·spec 됐기 때문에 스코프를 "트리거 진입 엔드포인트에 한정"으로 명확화한다. 이는 기존 규칙과 **모순이 아니라 적용 범위 명시**이며 타 spec 과의 직접 충돌은 없다.
- **제안**: 현행 webhook 규약을 소비하는 서드파티 통합 문서가 있다면 동기화 권장. 현재 EIA spec(14-external-interaction-api.md)은 `embed-config` 엔드포인트를 4-security 에서 정의하고 EIA 표면과 별개로 취급하므로 추가 수정 불필요.

---

### [INFO] `4-security.md` — EIA §8.4 rate-limit 구현 상태 기술이 EIA spec 과 정합
- **target 위치**: `spec/7-channel-web-chat/4-security.md` §4 (line 131)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §8.4 (line 724)
- **상세**: 기존 텍스트 "EIA §8.4 유지(interact 분당 60/execution, SSE 동시 3/execution)"가 구현 상태를 혼용 표기했는데, 이번 변경으로 "SSE 동시 3/execution 은 구현됨 / interact 분당 60/execution 은 Planned(미구현)"으로 분리됐다. EIA spec §8.4 (`RATE_LIMITED` 주석: "현재 `/interact`·status 조회에 per-execution rate-limit 이 적용되지 않아")와 정확히 일치한다. 충돌 없음, 오히려 동기화 개선.

---

## 요약

이번 diff 의 핵심은 `0-architecture.md` Rationale 섹션 번호 재매핑(R5→R2, R6→R3, R7→R4, R8→R5), `4-security.md` 에 Overview 섹션·신규 Rationale `R5`(sandbox allow-same-origin) 추가, `12-webhook.md` 의 GET 하위 경로 스코프 명확화다. Cross-spec 관점에서 CRITICAL 또는 WARNING 급 모순은 발견되지 않았다. 데이터 모델·API 계약·상태 전이·RBAC 어느 축에서도 기존 spec 과 직접 충돌하는 정의가 없으며, EIA §8.4 구현 상태 기술은 오히려 정합성을 높였다. 유일한 주의 사항은 `5-admin-console.md` 의 자기 참조 `§R6` 가 `0-architecture` 구 번호와 우연히 일치해 독자 혼동 소지가 있다는 점이나 내용상 오류는 아니다.

## 위험도

NONE
