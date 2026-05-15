파일을 읽었습니다. 이제 정식 규약과 대조하여 검토합니다.

---

## Convention Compliance Check 결과

### 검토 대상

`spec/data-flow/integration.md` — BullMQ 스케줄러 3분할 후 갱신된 data-flow spec

---

### 발견사항

- **[INFO]** 파일명에 숫자 prefix 없음
  - target 위치: 파일 경로 자체 (`spec/data-flow/integration.md`)
  - 위반 규약: CLAUDE.md 명명 컨벤션 — `spec/<영역>/N-name.md` 패턴
  - 상세: `data-flow/` 폴더 내 다른 파일이 `0-overview.md` 형식임을 고려하면, 숫자 prefix 없는 단일 도메인 파일은 미정렬 상태. 단, `data-flow/` 내 파일이 단 하나의 도메인만 다룰 경우 실질적 정렬 필요가 없음.
  - 제안: 폴더 내 파일이 2개 이상이라면 `1-integration.md` 로 rename 권장. 단독 파일이면 현행 유지 가능 (기존 파일명 변경은 별도 PR 범위).

---

### 규약별 적합성 판정

| 규약 | 판정 | 근거 |
|---|---|---|
| `cafe24-api-metadata.md` | 해당 없음 | 이 문서는 OAuth/install 흐름을 기술하며, Admin API operation metadata 형식 정의가 없음 |
| `migrations.md` | **적합** | 인라인 마이그레이션 번호 참조(V008→V009→…→V041→V042) 가 단조 증가 순서로 올바르게 기술됨 |
| `node-output.md` | **적합** | §1.3의 `throw INTEGRATION_EXPIRED / INTEGRATION_ERROR` 는 Principle 3.1의 pre-flight 에러 처리(credential 누락/만료 시 throw)와 일치. `integration_usage_log`의 `error={code,message}` 는 노드 핸들러 output이 아닌 내부 로그 필드로, Principle 3.2 적용 범위 밖 |
| CLAUDE.md 문서 구조 | **적합** | Overview → §1~§4 본문 → Rationale 3섹션 구조 충족. `(없음)` 표기는 구현 착수 메모란으로 보이며 문서 자체의 내용에는 문제 없음 |

---

### 요약

`spec/data-flow/integration.md` 는 규약을 전반적으로 잘 준수하고 있다. 세 개의 독립 BullMQ 스케줄러 분리(`connected-expiry-daily` / `pending-install-ttl-daily` / `usage-log-prune-daily`)를 기술한 §1.4·§2.2는 기존 data-flow 기술 패턴과 일관되며, 마이그레이션 번호 참조·에러 처리 방향·문서 구조 모두 정식 규약에 부합한다. 유일한 지적 사항은 파일명의 숫자 prefix 부재이며, 이는 구현 착수를 막을 이유가 되지 않는다.

### 위험도

**NONE** — 구현 착수 차단 사유 없음.