### 발견사항

- **[INFO] 감사 로그 내구성 향상 (보안 개선)**
  - 위치: `auth.service.ts` 전체, `sessions.service.ts:112, 159`
  - 상세: `void → await` 전환은 단순 race 해소 이상의 보안적 의미가 있습니다. 이전 패턴에서는 HTTP 응답 반환 ~ INSERT commit 사이에 crash window가 존재했고, 그 구간에서 서버가 재시작되면 `token_reuse_detected`, `login_failed` 같은 보안 크리티컬 이벤트가 누락될 수 있었습니다. `await`는 응답 전 커밋 완료를 보장해 감사 추적 무결성을 강화합니다.
  - 제안: 현 방향이 올바릅니다. 추가 개선 사항 없음.

---

- **[WARNING] DB 불가 시 보안 이벤트 무음 소실**
  - 위치: `login-history.service.ts:75–86` (`record()` catch 블록)
  - 상세: `record()`는 모든 예외를 내부에서 swallow합니다. DB가 불가 상태이거나 장기 latency 스파이크가 발생할 경우, `token_reuse_detected`(토큰 탈취 탐지), 반복 `login_failed` 등 보안 관점에서 가장 중요한 이벤트들이 ERROR 로그 한 줄로만 남고 영구 유실됩니다. `await` 전환 후에도 이 동작은 동일합니다.
  - 제안: 단기적으로는 현 tradeoff(가용성 > 감사 완결성)가 합리적입니다. 다만 `token_reuse_detected`와 같은 고위험 이벤트는 별도 fallback(예: 인메모리 큐 → 재시도, 또는 메트릭 카운터)을 두어 모니터링 가시성을 보완할 것을 권장합니다.

---

- **[INFO] `ACCOUNT_LOCKED` 응답이 계정 존재 여부를 노출**
  - 위치: `auth.service.ts:249–255`
  - 상세: `'Account locked. Try again in 10 minutes.'` 메시지는 해당 이메일로 계정이 존재함을 명시적으로 드러냅니다. `USER_NOT_FOUND`, `INVALID_PASSWORD` 경로는 모두 동일한 `'Invalid email or password'` 반환으로 열거를 방지하고 있으나, `ACCOUNT_LOCKED`만 예외입니다. 이번 PR이 도입한 문제는 아니지만, 이번 감사 리뷰 범위에서 식별됩니다.
  - 제안: `ACCOUNT_LOCKED` 시에도 `'Invalid email or password'`로 통일하거나, 제품 UX 설계 상 "계정 잠금 안내"가 의도된 경우라면 spec에 명시적으로 기록해 두길 권장합니다.

---

- **[INFO] `pruneOlderThanRetention`의 인라인 SQL 보간 패턴**
  - 위치: `login-history.service.ts:142–149`
  - 상세: `` `.where(`id IN (${sub.getQuery()})`)` ``는 TypeORM QueryBuilder가 생성한 파라미터화된 SQL 문자열을 보간합니다. 현재는 `cutoff`(서버 내부 계산 값)만 바인딩되고 사용자 입력이 `sub`에 유입되지 않으므로 인젝션 위험은 없습니다. 그러나 이 패턴은 향후 `sub`에 user-controlled 값이 추가될 경우 인젝션 벡터가 될 수 있습니다.
  - 제안: TypeORM의 `.subQuery()` 체인 방식으로 리팩토링하면 패턴 자체를 안전하게 가져갈 수 있습니다.

---

### 요약

이번 변경은 `void → await` 전환으로 감사 로그의 HTTP 응답 이전 커밋 완료를 보장합니다. 보안 관점에서 신규 취약점을 도입하지 않으며, 오히려 audit trail 무결성을 강화하는 방향으로 올바릅니다. 기존에 존재하던 문제로는 DB 불가 시 고위험 이벤트(토큰 재사용 탐지 등)의 무음 소실과 `ACCOUNT_LOCKED` 메시지의 계정 열거 가능성이 있으나, 전자는 감사 가용성 tradeoff 문제이고 후자는 UX 설계 결정 사항으로 이번 PR 범위 밖입니다. 암호화(bcrypt 12 rounds, SHA-256), 파라미터화된 쿼리, 제네릭 에러 메시지 등 핵심 보안 관행은 전반적으로 양호합니다.

### 위험도

**LOW**