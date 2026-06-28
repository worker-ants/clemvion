# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/5-system/12-webhook.md`
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] §3.1 API 표 "요청 본문 최대 크기 1MB" — 동일 문서 내 WH-NF-02·§8 과 사실 불일치

- **target 위치**: `spec/5-system/12-webhook.md` §3.1 "Webhook 수신 엔드포인트" 표 `요청 본문 최대 크기 | 1MB`
- **충돌 대상**: 동일 파일의 WH-NF-02(§3.3) 및 §8 보안 고려사항 표
- **상세**: §3.1 표는 "요청 본문 최대 크기: 1MB"를 기술하나, WH-NF-02와 §8은 "1MB 통일 임계는 미구현(Planned) — 현행은 공개 webhook 32KB / 인증 webhook 무제한"임을 명시한다. §3.1 표만 보면 1MB가 현행 구현인 것으로 오해할 수 있으며, 다른 영역 spec이 이 표를 인용하면 현행 동작과 어긋난 서술로 전파된다. `spec/7-channel-web-chat/4-security.md §4`도 32KB를 v1 구현으로 인용하고 있어 §3.1 표와 사실 불일치가 외부 영역 문서와도 충돌한다.
- **제안**: §3.1 표의 "1MB" 행을 "공개: 32KB / 인증: 제한 없음 (1MB 통일 Planned — WH-NF-02)" 형태로 WH-NF-02 와 동기화하거나, WH-NF-02 를 cross-ref 하는 주석을 추가한다. `plan/in-progress/spec-sync-webhook-gaps.md` 에 이미 Planned로 등록됐으므로 §3.1 표에도 동일 상태를 명시해야 혼선이 없다.

---

### [INFO] WH-EP-03 "POST 전용" 표현이 API 규약의 405 기술과 미세 표현 차이

- **target 위치**: `spec/5-system/12-webhook.md` WH-EP-03 "HTTP POST 메서드 지원 (POST 전용 — GET/PUT 미지원)" 및 Rationale ③
- **충돌 대상**: `spec/5-system/2-api-convention.md` §11.6 "webhook 수신 메서드로는 POST 만 지원하며 그 외 메서드는 405 Method Not Allowed"
- **상세**: target WH-EP-03은 "GET/PUT 미지원"이라고만 기술하고 405 응답 코드를 명시하지 않는다. API 규약은 405를 명시한다. 기능적 의미는 동일하나, WH-EP-03 표현은 응답 코드를 생략해 구현자가 다른 코드(예: 404)를 사용할 여지를 남긴다.
- **제안**: WH-EP-03에 "미지원 메서드는 `405 Method Not Allowed`" 를 추가해 API 규약과 표현을 일치시킨다.

---

### [INFO] Webhook spec §5 "워크플로우 입력 데이터 구조" 와 Manual Trigger spec §5.2 "output.request" 구조 — 기술 레이어 차이

- **target 위치**: `spec/5-system/12-webhook.md` §5 (flat 구조: `{ parameters, body, headers, query, method }`)
- **충돌 대상**: `spec/4-nodes/7-trigger/1-manual-trigger.md` §5.2 (handler output: `{ output.parameters, output.request: { method, headers, query, body } }`)
- **상세**: webhook spec §5는 어댑터가 `ExecutionEngineService.execute()` 에 전달하는 **adapter input** 레이어(내부 IPC)를 기술하고, manual-trigger spec §5.2는 핸들러가 이를 transform 한 후 다운스트림 노드가 `$input`/`$node["Manual Trigger"].output`으로 접근하는 **handler output** 레이어를 기술한다. 두 레이어는 의도적으로 분리된 설계이며 각 spec이 각자의 레이어를 SoT로 소유하므로 기능적 충돌은 아니다. 그러나 webhook spec §5 테이블에 다운스트림 접근 경로(`$params.<name>`)는 언급되면서 `body`/`headers`/`query` 필드의 다운스트림 접근 경로(`$node["Manual Trigger"].output.request.*`)는 누락돼 있어 독자가 `$input.body`로 직접 접근하려 할 수 있다.
- **제안**: webhook spec §5 표에 "다운스트림 expression 접근 경로는 [manual-trigger §5.2]를 참조" 크로스링크를 추가해 adapter input 과 handler output 레이어가 다름을 명확히 한다. 기능 충돌이 아니므로 수정 우선순위는 낮다.

---

### [INFO] WH-SC-09 ip_whitelist "클라이언트 IP를 알 수 없으면 거부(fail-closed)" — AuthConfig spec §2.17.5의 Rationale 과 일관

- **target 위치**: `spec/5-system/12-webhook.md` WH-SC-09
- **충돌 대상**: `spec/1-data-model.md` §2.17 + §2.17.5 Rationale (ip_whitelist 저장 시점 형식 검증)
- **상세**: target WH-SC-09는 "클라이언트 IP 불명 시 거부(fail-closed)"를 명시하고, data-model §2.17.5는 저장 시점 형식 검증과 런타임 평가 규칙을 기술한다. 두 문서 모두 `AuthConfig.ip_whitelist` 정책을 일관되게 기술 — 충돌 없음. INFO로 기재해 동기 필요성 모니터링.

---

## 요약

`spec/5-system/12-webhook.md` draft는 전반적으로 관련 영역 spec(`spec/1-data-model.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/7-channel-web-chat/4-security.md`)과 정합성이 높다. AuthConfig 단일 진입 정책, 처리 흐름 분기, 응답 코드 정책(202/401/404/410), RBAC, rate-limit 수치, 에러 코드 카탈로그 모두 타 영역 spec 과 일치한다. 발견된 주요 이슈는 **내부적인** 것으로, §3.1 API 표가 동일 문서 내 WH-NF-02·§8 과 본문 크기 한도 기술에서 불일치를 보인다(1MB vs 32KB/미구현). 이는 외부 영역 spec(`spec/7-channel-web-chat/4-security.md`)과도 표면적 충돌을 일으키므로 WARNING으로 분류한다. 나머지 발견사항은 기술 표현의 세밀도 차이 또는 명시적 설계 분리로, 기능적 모순 없이 INFO 수준에 해당한다.

## 위험도

LOW
