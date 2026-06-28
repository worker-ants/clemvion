# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/webhook-public-ip-failopen-hardening.md`
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] S-2 의 "R3 보강" 위치 — 기존 R3 는 fixed-window + fail-open 전반 rationale

- target 위치: plan §A Phase S-2 — `7-channel-web-chat/4-security.md R3`(rationale SoT) 에 공유 버킷·socket 폴백 기각 근거 명문화
- 관련 plan: 현재 `plan/in-progress/webhook-public-ip-failopen-hardening.md` 자체(설계 기술)
- 상세: `spec/7-channel-web-chat/4-security.md §Rationale ###R3` 은 현재 "fixed-window + fail-open" 선택 근거만 담고 있다(line 191~196). S-2 가 여기에 "IP 미식별 → 공유 버킷" 과 "socket 폴백 기각" 내용을 추가하는 것은 정합하지만, R3 의 현재 제목·본문이 해당 결정을 수용할 구조로 되어 있는지 기술 담당자(planner)가 확인 필요 — 공유 버킷 결정은 rate-limit 정책 분류라 R3 에 묶는 게 자연스럽고 충돌은 없다. spec-sync 계열 진행 중 plan(`spec-sync-auth-gaps.md` 등)은 이 파일을 건드리지 않으므로 간섭 없음.
- 제안: S-2 진행 시 R3 제목에 "IP 미식별 공유 버킷" 부제를 추가하고 본문을 분리 소항으로 구조화하면 기존 fixed-window 설명과 혼재 방지 가능. plan 자체 수정 불필요 — 구현 시 참고 메모로 충분.

### [INFO] S-4 — `1-auth.md` Rationale 2.3.B m-3 현행 기술 범위 확인

- target 위치: plan §A Phase S-4 — `5-system/1-auth.md Rationale 2.3.B m-3` 보강
- 관련 plan: `plan/in-progress/webhook-public-ip-failopen-hardening.md` S-4
- 상세: `spec/5-system/1-auth.md` Rationale 2.3.B m-3(line 662)은 이미 "rate-limit/ip_whitelist 의 IP 추출이 헤더 기반이고 `req.ip`/socket 폴백을 의도적으로 기각한다"는 설계 결정을 명시적으로 포함한다. S-4 는 "rate-limit null-IP 에도 적용됨을 보강 + 단일 공유 버킷 완화 한도로의 cross-ref" 를 추가하겠다는 것으로, 충돌이 아닌 확장이다. 미해결 결정을 우회하는 요소는 없음.
- 제안: S-4 작업 시 기존 문단이 이미 socket/req.ip 기각 이유를 상세히 설명하므로 중복 서술 없이 "null-IP → 공유 버킷 완화 한도" 귀결 한 문장 + 4-security R3 cross-ref 추가로 최소 보강 권장.

### [INFO] 결정 1(WAF/Ingress 권고 문서화) 의 spec 위치 미지정

- target 위치: plan §결정 1 — "CF/WAF/Ingress 에서 XFF 강제·헤더 없는 외부 요청 차단" 을 managed 배포용 권고로 spec 에 기재
- 관련 plan: `plan/in-progress/self-hosting-deployment.md` (unstarted) — 셀프호스팅 배포 가이드
- 상세: 결정 1 의 인프라 권고를 어느 spec 문서에 기재할지 plan §A Phase 에 명시적 task 가 없다. S-1~S-4 는 각각 `4-security.md §4`, `4-security.md R3`, `12-webhook.md`, `1-auth.md` 를 대상으로 지정하는데, WAF/Ingress 권고 기재 위치는 이 중 어디에도 명시되지 않는다. `self-hosting-deployment.md` 는 미착수이며 이 배포 가이드 쪽에 결합될 후보도 있다. 내용 자체의 결정은 plan 에서 확정(결정 1)됐고 미해결 상태가 아니므로 CRITICAL/WARNING 이 아니나, 실행 단계에서 기재 위치를 확인 없이 지나치면 누락될 수 있다.
- 제안: plan S-1 또는 별도 S-1b task 로 "WAF/Ingress 권고 기재 위치(4-security §4 blockquote 또는 별도 subsection)" 를 명시화하거나, spec 작업 착수 시 planner 가 결정. plan 업데이트 권장.

---

## 요약

`webhook-public-ip-failopen-hardening.md` 의 세 결정(앱 우선 + 인프라 권고, socket 폴백 기각, 공유 버킷 완화 한도)은 모두 사용자 확정 상태이고, 현행 `spec/7-channel-web-chat/4-security.md` 및 `spec/5-system/1-auth.md` 의 미해결 결정 사항과 충돌하지 않는다. `1-auth.md` Rationale 2.3.B m-3 이 이미 headers-only 방침과 socket/req.ip 기각 근거를 포함하므로 S-4 는 확장이지 번복이 아니다. 다른 진행 중 plan(`spec-sync-*` / `self-hosting-deployment`) 에서 동일 spec 영역을 수정 중인 항목은 발견되지 않아 간섭 위험은 낮다. 유일한 실용적 주의는 결정 1 의 WAF/Ingress 권고를 spec 어느 섹션에 기재할지가 Phase S-* 에 명시되지 않아 구현 단계 누락 가능성이 있다는 점이다.

## 위험도

LOW
