# Cross-Spec 일관성 검토 결과

검토 모드: --impl-done (구현 완료 후)
diff-base: 1899c05e7ac5034b41d3a71462d6478487ed154d
대상: spec/1-data-model.md §2.17 (ip_whitelist 저장 시점 형식 검증 추가) + spec/2-navigation/6-config.md §A.4 (create/regenerate 자동 hide 정책 명시)

---

## 발견사항

### [INFO] ip_whitelist 저장 시점 검증 규칙이 spec/5-system/12-webhook.md WH-SC-09 에 미반영
- target 위치: `spec/1-data-model.md §2.17 ip_whitelist` 행 — "저장(create/update) 시 각 항목을 형식 검증하며 단일 IP/CIDR(IPv4·IPv6) 가 아니면 `400` 으로 거부한다"
- 충돌 대상: `spec/5-system/12-webhook.md §3.2 WH-SC-09` — "각 항목은 단일 IP 또는 CIDR 표기를 허용하며"라고만 서술하며, 저장 시점(create/update) 형식 검증 규칙이 없다
- 상세: 두 문서 간 직접 모순은 아니다. data-model.md §2.17 이 ip_whitelist 의 단일 진실이며, webhook spec 은 런타임 평가 행동을 기술한다. 그러나 WH-SC-09 는 "수용 기준"을 묘사하면서 저장 시점 검증 규칙을 침묵하고 있어, webhook spec 을 단독으로 읽을 때 "런타임 평가에서만 거부된다"는 오해를 줄 수 있다. 정보 불일치(누락)이지 모순은 아님.
- 제안: spec/5-system/12-webhook.md WH-SC-09 행에 "형식 검증은 저장(create/update) 시 DTO 레이어에서 선행 수행 — 참조 spec/1-data-model.md §2.17" 주석을 추가하거나, 기존 문구가 런타임 전용임을 명확히 구분하는 동기화 작업 권장 (필수는 아님, SoT 는 data-model.md).

---

### [INFO] spec/data-flow/10-triggers.md 의 auth_config 런타임 평가 흐름에 저장 시점 검증 언급 없음
- target 위치: `spec/1-data-model.md §2.17 ip_whitelist` 저장 검증 규칙
- 충돌 대상: `spec/data-flow/10-triggers.md` 84행 — 시퀀스 다이어그램에서 `AC->>AC: is_active 확인 + ip_whitelist (있으면) + AuthConfig.type 별 검증` 이라 기술하며, 해당 note 는 ip_whitelist 런타임 평가만 다룬다
- 상세: data-flow spec 은 webhook 수신 런타임 흐름을 다루므로 저장 시점 검증을 포함하지 않는 것이 자연스럽다. 그러나 "ip_whitelist 는 AuthConfig 종속" 주석이 저장 시점 형식 검증 규칙 없이 런타임 전용 설명으로 일관되어 있어 정보 비대칭이 존재한다. 모순은 아님.
- 제안: 동기화 필수 아님. data-flow 문서는 런타임 흐름 SoT 이며 저장 시점 검증은 data-model.md 의 책임 영역이다.

---

### [INFO] spec/2-navigation/6-config.md §A.4 — create/regenerate 자동 hide 는 신규 추가이며 spec/1-data-model.md §2.17.2 "마스킹·노출 정책" 에 언급 없음
- target 위치: `spec/2-navigation/6-config.md §A.4` Reveal 흐름 블록 이후 note — "평문 자동 hide 정책은 create / regenerate 의 1회 노출에도 동일 적용된다 — 생성·재생성 직후 표시된 평문 키도 30초 후 자동으로 비워"
- 충돌 대상: `spec/1-data-model.md §2.17.2 마스킹·노출 정책` — "본 §2.17.2 가 AuthConfig 마스킹 정책의 단일 진실"이라 선언되어 있으나, 30초 UI 자동 hide 정책(create/regenerate 포함)에 대한 언급이 없음
- 상세: §2.17.2 는 "어떤 경로가 평문을 노출하는가"(create/regenerate/reveal 3 경로)를 다루는 SoT 로 선언되었다. 기존에는 30초 자동 hide 가 §A.4 reveal 단계(단계 4)에만 명시되어 있었고, create/regenerate 는 미명시였다. 이번 target 변경으로 6-config.md §A.4 에는 "create/regenerate 도 30초 후 자동 hide" 규칙이 추가되었지만, §2.17.2 SoT 에는 이 UI-레벨 정책이 반영되지 않았다. 직접 모순이 아니라 (§2.17.2 는 API 계약 레벨 마스킹 정책이며 UI 타이머는 프런트엔드 보안 정책으로 분리 가능), UI 정책 SoT 경계가 불명확한 상태다.
- 제안: §2.17.2 가 "AuthConfig 마스킹 정책의 단일 진실"이라면 UI 자동 hide 30초 정책도 §2.17.2 에 1줄 추가해 SoT 위치를 일치시키거나, §2.17.2 범위를 "API 계약 레벨 마스킹" 으로 명확히 제한하고 UI 타이머 정책 SoT 를 6-config.md §A.4 로 명시하면 경계가 분명해진다. 어느 쪽이든 현재는 SoT 경계 모호함이 남는다.

---

## 요약

이번 변경(spec/1-data-model.md §2.17 ip_whitelist 저장 시점 형식 검증 추가 + spec/2-navigation/6-config.md §A.4 create/regenerate 30초 자동 hide 명시)은 기존 spec 과 직접 모순을 일으키지 않는다. spec/5-system/12-webhook.md WH-SC-09 와 spec/data-flow/10-triggers.md 는 런타임 ip_whitelist 평가만 기술하고 있어 저장 시점 검증 규칙과 영역이 분리되며 충돌이 없다. data-model.md §2.17 이 ip_whitelist 의 SoT 로 동작하는 구조도 유지된다. 다만 §2.17.2 가 "AuthConfig 마스킹 정책의 단일 진실"로 선언되어 있음에도 6-config.md §A.4 에 신규 추가된 UI 30초 자동 hide 정책(create/regenerate 포함)이 §2.17.2 에 동기화되지 않아 SoT 경계 모호함이 INFO 수준으로 존재한다. 전체적으로 채택 가능한 변경이며 CRITICAL/WARNING 수준 충돌은 없다.

## 위험도

LOW
