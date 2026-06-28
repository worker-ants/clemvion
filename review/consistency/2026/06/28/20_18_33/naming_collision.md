# 신규 식별자 충돌 검토 — webhook-public-ip-failopen-hardening

검토 모드: spec draft (--spec)
Target: `plan/in-progress/webhook-public-ip-failopen-hardening.md`

---

## 발견사항

- **[WARNING]** `R3` rationale 레이블 충돌 — `4-security.md` 에 이미 존재
  - target 신규 식별자: plan S-2 에서 "R3" 를 신규 rationale 항목으로 `spec/7-channel-web-chat/4-security.md` 에 추가하도록 지시
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md` line 191 — `### R3. 남용 방어 rate-limit — fixed-window + fail-open` 이 **이미 존재**
  - 상세: plan 이 "R3" 를 "공유 버킷 vs fail-open/closed, socket 폴백 기각 근거 명문화" 신규 rationale 로 추가하도록 지시하나, 해당 파일에는 `### R3. 남용 방어 rate-limit — fixed-window + fail-open`(rate-limit 설계 근거) 가 이미 등록되어 있다. 신규 R3 를 그대로 쓰면 같은 앵커(`#r3`)가 두 절을 가리키게 되어 링크·참조 혼선이 생긴다.
  - 제안: 신규 rationale 절을 `### R3` 대신 `### R4` (또는 목록상 다음 번호) 로 배정하거나, 기존 `R3` 의 내용을 확장해 공유 버킷·socket 폴백 기각 근거를 인라인으로 흡수한다.

- **[INFO]** sentinel 상수 `UNIDENTIFIED_IP_BUCKET` / 값 `'__no_client_ip__'` — 기존 코드베이스와의 의미 접점 없음, 신규 도입 확인 필요
  - target 신규 식별자: `UNIDENTIFIED_IP_BUCKET` (상수명), `'__no_client_ip__'` (sentinel 문자열 값)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` — `UNIDENTIFIED_IP_BUCKET`/`__no_client_ip__` 두 이름 모두 현재 코드에 **존재하지 않음**. 기존 `makeMinKey`/`makeHourKey` 함수는 `wh:rl:min:<ip>` / `wh:rl:hour:<ip>` 패턴이고 `consumeStart(ip: string)` 는 IP 문자열을 그대로 받는다.
  - 상세: 충돌 없음. 다만 sentinel 값 `'__no_client_ip__'` 를 Redis 키로 쓰면 `wh:rl:min:__no_client_ip__` / `wh:rl:hour:__no_client_ip__` 형태가 되어 일반 IP 키(`wh:rl:min:1.2.3.4`)와 자연스럽게 분리된다. Redis 네임스페이스 충돌은 없으나, 향후 로그·메트릭이 이 sentinel 키를 "이상한 IP"로 오분류하지 않도록 주석 명시가 권장된다.
  - 제안: 상수 이름과 sentinel 값을 그대로 사용해도 무방하다. 단 `makeMinKey`/`makeHourKey` 함수의 JSDoc 또는 `consumeStart` 시그니처에 "sentinel 포함 가능" 을 한 줄 기재하면 향후 혼선을 방지한다.

- **[INFO]** plan 태스크 레이블 `S-1`~`S-4` / `I-1`~`I-2` — 같은 파일 내 로컬 식별자, 전역 충돌 없음
  - target 신규 식별자: plan Phase A 의 `S-1`, `S-2`, `S-3`, `S-4` 및 Phase B 의 `I-1`, `I-2`
  - 기존 사용처: in-progress plan 디렉터리(`/Volumes/project/private/clemvion/plan/in-progress/`) 에서 `S-1`~`S-4` 패턴은 Slack spec 참조(`R-S-3` 등)에서 부분 사용되나, 이는 spec의 rationale 앵커 이름이지 plan task 레이블이 아니다. plan 내 독립 로컬 레이블로 취급되므로 전역 충돌 없음.
  - 상세: 다른 in-progress plan(`cafe24-backlog-residual.md`)의 `D-2` 처럼 plan-local 레이블이므로 cross-plan 충돌은 발생하지 않는다.
  - 제안: 현행 유지.

- **[INFO]** `D-12` 식별자 — `webhook-hardening-cleanup.md` 에서 이미 정의되어 있고, target plan 이 그 산출물임 — 충돌 아님
  - target 신규 식별자: plan 제목 "D-12" 참조
  - 기존 사용처: `/Volumes/project/private/clemvion/plan/in-progress/webhook-hardening-cleanup.md` line 35 — `D-12(IP 미식별 fail-open 우회) — webhook-public-ip-failopen-hardening.md plan 신설(보안 결정 필요)` 로 이미 등록
  - 상세: target plan 이 D-12 의 실행 결과물이므로 동일 식별자 사용은 의도된 cross-reference 이며 의미 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** WH-SC-05 불릿 업데이트 — 기존 WH-SC-05 와 의미 확장, 충돌 없음
  - target 신규 식별자: plan S-3 에서 "WH-SC-05 에 IP 미식별 처리 한 줄" 추가를 지시
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/12-webhook.md` line 69 — `WH-SC-05 | Rate limiting … 공개 webhook … IP 단위 한도 … §6 참조`
  - 상세: 기존 WH-SC-05 는 IP 미식별 시 동작을 기재하지 않는다. plan 이 기존 셀에 한 줄을 **추가**하는 것이므로 새 ID 도입이 아니라 기존 ID 내용 보강이다. 식별자 충돌 없음.
  - 제안: WH-SC-05 셀을 보강할 때 "IP 미식별 시 단일 공유 버킷(`UNIDENTIFIED_IP_BUCKET`) 으로 fall-through" 를 명시하고 §4-security R3 (또는 신규 R 번호, 위 WARNING 참조) 를 교차 참조한다.

---

## 요약

target plan 이 새로 도입하는 식별자(`UNIDENTIFIED_IP_BUCKET`, `__no_client_ip__`, `S-1`~`S-4`, `I-1`~`I-2`, `D-12`)는 기존 코드베이스·spec 과 의미 충돌이 없다. 유일하게 실질적인 위험은 **`spec/7-channel-web-chat/4-security.md` 의 Rationale `R3`** 로, plan S-2 가 이 레이블을 신규 절로 지시하지만 해당 파일에는 `R3. 남용 방어 rate-limit — fixed-window + fail-open` 이 이미 존재한다. spec 작성 시 기존 R3 와 다른 번호를 사용하거나 기존 R3 에 내용을 병합해야 한다.

---

## 위험도

LOW
