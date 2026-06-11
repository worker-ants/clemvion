# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] 파일 1: integration-expiry-scanner.service.spec.ts

변경 의도에 부합하는 수정만 포함되어 있다.

- 기존 cafe24 테스트에서 `statusReason: 'token_expired'` 검증 추가 (V-07 대응)
- cafe24 passive 알림 "발사 검증" → "미발사 검증"으로 교체 (V-07 §11.2 대응)
- 테스트 설명(it 문자열)에 `§11.2` 참조 추가 — 규약 내 주석 변경이며 의도 범위 내
- makeshop 2개 신규 케이스 추가 (V-01 대응 — refresh_token 유무 분기)
- 범위 밖 수정 없음

---

### [INFO] 파일 2: integration-expiry-scanner.service.ts

핵심 구현 변경. 범위를 벗어난 수정은 없다.

- `isCafe24RefreshCapable` → `isRefreshCapable` 함수 이름·로직 일반화 (V-01 직접 수정)
- `isRefreshCapable` 분기를 claim/격하/알림 전체 앞으로 이동 — refresh-capable 은 claim dedup 도 수행하지 않도록 구조 변경. 이는 §11.2 채택(V-07)의 논리적 귀결이며 과도한 리팩토링이 아님
- 0d 격하 시 `statusReason = 'token_expired'` 설정 (was null) — V-07
- enqueue 실패 시 "알림 그대로 발사" 주석 삭제 — §11.2 채택으로 의미가 사라진 주석 제거이므로 정당
- 함수 JSDoc 전면 재작성 — cafe24 한정 설명에서 cafe24·makeshop 포함 설명으로 확장. 내용이 실질 변경(함수 시그니처·동작 변경)을 정확히 반영하므로 불필요한 주석 변경 아님
- 범위 밖 수정 없음

---

### [INFO] 파일 3: integration-status-reason.ts

- `'token_expired'` 슬러그 1개 추가 및 인라인 주석 (V-07)
- 기존 코드 일체 미변경
- 범위 밖 수정 없음

---

### [INFO] 파일 4: system-status.constants.spec.ts (신규)

- MONITORED_QUEUES ↔ spec 카탈로그 동기 검증 테스트 신설 (V-15 회귀 방지)
- plan 체크리스트에 명시된 정당한 추가 파일
- 범위 밖 수정 없음

---

### [INFO] 파일 5: system-status.constants.ts

- `MAKESHOP_REFRESH_QUEUE` import 1줄 + `MONITORED_QUEUES` 배열 항목 1개 추가 (V-15)
- 기존 항목 일체 미변경
- 범위 밖 수정 없음

---

### [INFO] 파일 6: system-status.e2e-spec.ts

- `EXPECTED_QUEUE_NAMES` 배열에 `'makeshop-token-refresh'` 추가 (V-15 직접 대응)
- 큐 개수 문자열 13 → 14 갱신 (주석 + 테스트 설명 2곳)
- 기존 테스트 로직 미변경
- 범위 밖 수정 없음

---

### [INFO] 파일 7: plan/in-progress/integration-expiry-fixes.md (신규)

- 작업 추적용 plan 파일 신설 — CLAUDE.md 규약(plan/in-progress/ 관리)에 따른 정상 산출물
- 범위 밖 수정 없음

---

### [WARNING] 파일 8: spec/1-data-model.md — `status_reason` 컬럼 설명 확장

- 위치: `status_reason` 행 설명 말미
- 상세: `token_expired` 슬러그 신규 추가 및 `unknown` → `unknown_error` 정정은 V-07 직접 대응으로 정당하다. 그러나 말미에 추가된 "※ `token_expired` 는 본 컬럼 전용 슬러그 — JWT 만료 REST 에러 `TOKEN_EXPIRED`·WebSocket 이벤트 `auth.token_expired` 와 표기가 유사하나 별개 네임스페이스다" 문구는 V-01/V-07/V-15 버그 수정 범위를 명시적으로 넘어서는 네임스페이스 명료화 추가다. 기술적으로 틀린 내용은 아니며 향후 혼동 방지에 유용하지만, 버그 수정 PR 의 필수 변경은 아니다.
- 제안: 허용 범위로 볼 수 있으나, 문서 변경 범위를 V-07 직접 변경으로 제한한다면 해당 NOTE 문구를 별도 docs PR 로 분리하는 것을 고려할 수 있다. 동작 변경은 아니므로 심각도는 낮다.

---

### [INFO] 파일 9: spec/2-navigation/4-integration.md

- cafe24 note blockquote 재작성 — refresh-capable 동작 설명이 §11.2 채택(V-07)·makeshop 포함(V-01)을 반영하도록 갱신. 실질 구현 변경과 1:1 대응
- §11.1 표 `connected-expiry` 행 재작성 — makeshop 포함, passive 알림 제외, `status_reason=token_expired` 추가 (V-01 + V-07)
- §11.1 의사코드(pseudocode) 블록 재작성 — `isRefreshCapable` 분기 추가, 옛 `isCafe24RefreshCapable` 분기 제거 (V-01 + V-07)
- MakeShop note blockquote — `isCafe24RefreshCapable` → `isRefreshCapable` 참조 갱신 (V-01)
- 범위 밖 수정 없음

---

### [INFO] 파일 10: spec/data-flow/5-integration.md

- §1.4 표 `connected-expiry` 행 재작성 (V-01 + V-07 반영)
- "알려진 구현 갭 MakeShop 행의 0d 격하" callout 제거 — 갭이 해소됐으므로 정당
- Rationale 폐기 섹션: 10개 줄 삭제 후 1줄 요약으로 교체 (갭 해소 사실 기록) — 범위 내 정당한 문서 정리
- mermaid 다이어그램 내 `status_reason=NULL` 표기가 `status_reason=token_expired` 로 갱신되지 않고 옛 표기(`UPDATE integration SET status='expired', status_reason=NULL`)가 잔존함. 구현과 불일치. 단, 이 다이어그램은 이번 PR에서 변경된 부분이 아니라 기존 다이어그램이며, 새로 수정된 §1.4 표와 의사코드는 올바르게 반영됨.
  - 위치: spec/data-flow/5-integration.md — `§1.4` mermaid sequenceDiagram 내 `Scan->>PG: UPDATE integration SET status='expired', status_reason=NULL` 라인

---

### [WARNING] spec/data-flow/5-integration.md — mermaid 다이어그램 미갱신

- 위치: spec/data-flow/5-integration.md, §1.4 mermaid sequenceDiagram
- 상세: 이번 PR이 명시적으로 갱신한 §1.4 표와 의사코드는 `status_reason='token_expired'` 와 `isRefreshCapable` 분기를 올바르게 반영하나, 같은 섹션의 sequenceDiagram 내 `Scan->>PG: UPDATE integration SET status='expired', status_reason=NULL` 라인이 옛 표기(`status_reason=NULL`)로 잔존한다. V-07 변경(0d 격하 시 `statusReason='token_expired'` 설정)을 스캐너 코드·유닛 테스트·§1.4 표에서는 반영했지만 이 다이어그램에서는 누락됐다. 스펙과 구현 불일치를 부분적으로 재도입한다.
- 제안: 해당 라인을 `Scan->>PG: UPDATE integration SET status='expired', status_reason='token_expired'` 로 갱신하거나, 다이어그램 노트에 "(token_expired — refresh_token 없는 provider)" 주석을 추가할 것.

---

## 요약

10개 파일 전체에서 의도된 세 가지 버그 수정(V-01 makeshop 오격하, V-07 §11.2 passive 알림 정합, V-15 큐 레지스트리 동기)의 범위를 벗어난 무관한 수정·리팩토링·기능 추가는 없다. 구현 변경에 수반하는 spec 문서·테스트·plan 파일 업데이트는 모두 직접 대응 범위 내에 있다. 단, `spec/data-flow/5-integration.md` mermaid 다이어그램의 `status_reason=NULL` 표기가 갱신되지 않아 V-07 변경이 해당 다이어그램에만 반영되지 않은 소규모 불일치가 있으며, `spec/1-data-model.md` 의 네임스페이스 NOTE 추가는 버그 수정의 필수 범위를 소폭 초과하는 문서 친절도 추가이나 동작에 영향을 주지 않는다.

## 위험도

LOW
