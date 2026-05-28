# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-triggers-auth-column.md`
검토 모드: spec draft 검토 (--spec)
검토일: 2026-05-29

---

## 발견사항

- **[INFO]** WH-SC-01 "인증 없음(공개) 옵션" 과 R-15 경고 표시의 관계 명시 보완
  - target 위치: `변경 2 — R-15` 본문, "경고는 차단이 아니라 신호다" 단락
  - 과거 결정 출처: `spec/5-system/12-webhook.md §3.2 WH-SC-01` — "인증 없음(공개) 옵션 — `auth_config_id IS NULL`. `endpointPath` UUID 가 사실상 비밀 키" (필수 요구사항)
  - 상세: WH-SC-01 은 `auth_config_id IS NULL` 을 명시적으로 지원되는 "공개(open)" 옵션으로 정의하며, `endpointPath` UUID 자체를 capability-like 식별자로 보는 설계 의도를 담고 있다. R-15 는 이 상태에 경고 아이콘을 붙이는 결정인데, 경고가 WH-SC-01 의 "공개 옵션은 지원됨" 설계와 모순되지 않는다는 점은 R-15 본문에서 "신뢰 네트워크 use case 존재" 한 줄로만 처리되어 있다. WH-SC-01 의 `endpointPath UUID = 사실상 비밀 키` 관점에서 "그럼에도 경고를 표시하는 이유" 에 대한 명시적 접점이 없어, 향후 검토자가 경고와 WH-SC-01 설계 의도가 충돌한다고 오인할 소지가 있다.
  - 제안: R-15 의 "경고는 차단이 아니라 신호다" 단락에 "WH-SC-01 에서 인증 없음은 지원되는 공개 옵션이며 `endpointPath` UUID 가 capability token 역할을 겸한다. 경고는 그 옵션이 의도적인지 확인을 돕는 가시성 장치이며, WH-SC-01 의 필수 요구사항을 변경하지 않는다" 한 문장을 보강하면 Rationale 정합이 완결된다.

---

### 요약

target 문서(`spec-draft-triggers-auth-column.md`) 는 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하는 내용을 포함하지 않는다. R-14 가 확립한 `authConfigId` 단일 경로 원칙과 정합하며, "생성/저장 시 무인증 차단" 을 명시적으로 기각하여 R-14 의 선택지 구조와 일관성을 유지한다. `spec/5-system/12-webhook.md` 의 `inline auth path 폐지` Rationale 및 `WH-SC-01` ("인증 없음 공개 옵션은 필수") 와도 직접 충돌하지 않는다. 다만 WH-SC-01 의 `endpointPath UUID = 사실상 비밀 키` 설계 의도와 R-15 경고 표시의 관계가 R-15 본문에서 명시적으로 연결되지 않아, INFO 수준의 보완 여지가 있다. 전체적으로 Rationale 연속성은 양호하다.

### 위험도

LOW
