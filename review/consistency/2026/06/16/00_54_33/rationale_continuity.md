# Rationale 연속성 검토 결과

검토 범위: `spec/1-data-model.md`, `spec/2-navigation/6-config.md`
diff-base: `1899c05e7ac5034b41d3a71462d6478487ed154d`
변경 커밋: `1fa0ad1b`, `8ab9f197`

---

## 발견사항

### [INFO] ip_whitelist 저장 검증 명문화 — Rationale 미기재
- **target 위치**: `spec/1-data-model.md §2.17 AuthConfig.ip_whitelist` 필드 설명 (줄 610)
- **과거 결정 출처**: `spec/1-data-model.md §2.17.3 Rationale (AuthConfig 도메인)`, `spec/2-navigation/6-config.md ## Rationale R-2`
- **상세**: 이번 변경은 `ip_whitelist`에 "저장(create/update) 시 각 항목을 형식 검증하며 유효하지 않으면 400 으로 거부한다"는 새 동작을 본문에 추가했다. 기존 Rationale(`§2.17.3`)에는 ip_whitelist 저장 검증 여부에 대한 결정이 없었고(`§2.17.3`은 `hmac` type, `none` 미포함, `bearer_token` 자동 발급, TypeScript 타입명 분리, transformer 공유 만 다룬다), `6-config.md R-2`도 저장 시 검증을 명시적으로 배제하거나 채택하지 않았다. 즉 기각된 대안의 재도입이나 합의된 원칙 위반은 아니지만, 새 제약("저장 시 형식 검증, 런타임 평가와 동일한 수용 기준")을 추가하는 결정임에도 `§2.17.3 Rationale` 에 설계 근거가 기록되지 않았다.
- **제안**: `spec/1-data-model.md §2.17.3`에 다음 항목 추가를 검토한다 — "**ip_whitelist 저장 시 형식 검증**: 저장(create/update) 시 각 항목을 단일 IP/CIDR(IPv4·IPv6) 형식으로 검증해 런타임 평가와 동일한 수용 기준을 유지한다. 이는 malformed 항목이 저장돼 런타임에 비결정적 동작(항상 거부 또는 항상 통과)을 유발하는 것을 구조적으로 차단한다." 기존 WH-SC-09 런타임 시행과 쌍을 이루는 저장 시점 보증이라는 맥락이 Rationale에 명시되면 충분하다.

---

### [INFO] Reveal 30초 자동 hide 정책을 create/regenerate로 확장 — Rationale 미기재
- **target 위치**: `spec/2-navigation/6-config.md §A.4 Reveal 흐름` (줄 122, 신규 블록쿼트)
- **과거 결정 출처**: `spec/1-data-model.md §2.17.2 마스킹·노출 정책` ("평문 노출은 다음 3 경로만 허용"), `spec/2-navigation/6-config.md §A.4` 4번 단계 ("30초 후 자동 hide")
- **상세**: 기존 spec은 Reveal 흐름 4번 단계에만 "30초 후 자동 hide"를 명시했고, `§2.17.2`는 "1회 응답"이라는 API 레이어 정책만 정의했다. 이번 변경은 create / regenerate의 생성 직후 표시된 평문도 30초 후 자동으로 비운다는 프론트엔드 UX 정책을 `6-config.md §A.4`에 추가했다. `§2.17.2`는 "1회 응답"을 HTTP 응답 단위로 정의하고 있으며 UI 자동 hide를 명시적으로 배제하는 Rationale가 없으므로 기각된 대안의 재도입이나 합의 원칙 위반은 아니다. 다만 이 정책 확장이 "왜 create/regenerate 1회 응답에도 동일 자동 hide를 적용하는가"에 대한 근거 없이 본문에만 추가됐다.
- **제안**: `spec/2-navigation/6-config.md ## Rationale`에 간단한 항목을 추가한다 — "**create/regenerate 1회 노출에도 30초 자동 hide 적용**: §2.17.2 의 '1회 응답' 은 HTTP 응답 단위의 API 정책이며, 화면 방치 시 평문이 노출되는 위험은 API 응답 이후에도 이어진다. create/regenerate 직후 표시된 평문에도 Reveal 흐름과 동일한 30초 타이머를 적용해 노출 시간을 일관되게 제한한다." Rationale에 기록하지 않아도 정합성에 문제는 없으나, 검토자가 '1회 응답 = API 전용' 과 'UI 자동 hide' 를 혼동하지 않도록 명시를 권장한다.

---

## 요약

이번 target 변경(`spec/1-data-model.md`, `spec/2-navigation/6-config.md`)은 ip_whitelist 저장 시 형식 검증 추가와 평문 자동 hide 정책의 create/regenerate 확장 두 가지다. 어느 쪽도 기존 Rationale에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙·invariant를 위반하지 않는다. 두 변경 모두 기존 Rationale의 공백(저장 검증 미언급, UI 자동 hide 범위 미정의)을 구현으로 채운 것이며, Rationale 자체의 결정을 번복하지 않는다. 다만 새 동작이 spec 본문에만 추가되고 해당 섹션의 Rationale에 근거가 기록되지 않아, 추후 리뷰어가 "왜 저장 시점에도 검증하는가" / "왜 30초 hide를 모든 1회 노출로 확장하는가"를 Rationale에서 찾지 못하는 유지보수 비용이 남는다.

## 위험도

LOW
