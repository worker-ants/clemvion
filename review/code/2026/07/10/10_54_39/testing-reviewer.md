# 테스트 리뷰 — HEAD 90ab8f390

리뷰 대상: `refactor(shared·mcp): URI-userinfo 마스킹을 공용 SoT 로 통합 (파편화 제거)`

변경 파일:
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` / `.spec.ts`
- `codebase/backend/src/modules/mcp/mcp-error-codes.ts` / `.spec.ts`
- `spec/5-system/11-mcp-client.md`

## 실행 결과

```
cd codebase/backend && npx jest "shared/utils/sanitize-error-message" mcp-error-codes mcp-client \
  thread-renderer "execution-engine/sanitize-error-message" cafe24 makeshop integration-oauth
→ Test Suites: 30 passed, 30 total / Tests: 704 passed, 704 total
```

`redactSecrets`/`SECRET_LEAK_PATTERNS`/`deepRedactSecrets` 의 추가 소비처(위 키워드에 안 걸리는 것)도 보충 확인:

```
cd codebase/backend && npx jest interaction.service ai-turn-orchestrator retry-after \
  background-execution.processor schedule-runner
→ Test Suites: 7 passed, 7 total / Tests: 179 passed, 179 total
```

두 실행 모두 exact-string assertion 깨짐 없이 통과. (`--listTests` 로 매칭된 30 suite 목록도 대조 — cafe24/makeshop mcp-tool-provider spec, mcp-client.service.spec 포함 확인.)

## 발견사항

- **[INFO]** password 세그먼트에 콜론(`:`)이 포함된 URI-userinfo 케이스가 새 회귀 테스트로 pin 되지 않음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:51` (신규 정규식), `sanitize-error-message.spec.ts` (해당 케이스 부재)
  - 상세: 구 정규식 password 클래스는 `[^/\s:@]+` (콜론 제외) 였고, 신규는 `[^/\s@]+` (콜론 허용, `@` lookahead 로만 경계)로 바뀌었다. 이는 whole-mask→scheme-preserving 전환의 부수 효과로, `https://admin:pa:ss@host/x` 같이 password 자체에 콜론이 들어간 입력에서 동작이 달라진다 — 구 정규식은 이 케이스에서 아예 매치 실패(password 전체가 마스킹 없이 그대로 노출되는 잠재 리크)였고, 신규 정규식은 정상적으로 `https://***@host/x` 로 마스킹한다(트레이스 확인: lookbehind/lookahead 방식은 password 클래스가 `@` 직전까지 그리디하게 콜론을 포함해 흡수). 즉 **보안적으로는 개선**이지만, 이 개선이 의도된 것인지 우연한 부수효과인지 테스트로 pin 되어 있지 않아 향후 정규식을 다시 만질 때 이 케이스가 조용히 재퇴행해도 잡히지 않는다.
  - 제안: `sanitize-error-message.spec.ts` 의 userinfo describe 블록에 `it('masks a password containing an embedded colon (scheme-preserving)', ...)` 케이스를 추가 — 예: `redactSecrets('https://admin:pa:ss@host/x')` → `toContain('https://***@host/x')`. 1줄 케이스로 비용 대비 회귀 가드 효과가 크다.

- **[INFO]** `mcp-error-codes.spec.ts` 에는 FP 가드(IPv6·host:port·SSH shorthand·콜론 프로즈) 전용 케이스가 없음
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.spec.ts`
  - 상세: `redactMcpSecrets` 은 `SECRET_LEAK_PATTERNS` 배열을 그대로 순회 적용하므로 (MCP 쪽에서 패턴을 변형하지 않음) shared spec 의 FP 가드(`sanitize-error-message.spec.ts` 의 `does not false-positive on %s` `it.each`)가 transitively 적용된다. 실질적 커버리지 갭은 아니라고 판단 — 조치 불필요, 참고로만 기록.

- **[INFO]** 테스트 타이틀 "masks non-DB URI userinfo too (redis/custom schemes)" 의 "non-DB" 라벨이 다소 오해 소지
  - 위치: `sanitize-error-message.spec.ts:69`
  - 상세: `execution-engine/sanitize-error-message.ts` 의 별도 `CONNECTION_STRING_PATTERN` 은 `redis://` 를 DB-유사 스킴으로 취급해 이 함수에 도달하기 전에 `[REDACTED_URI]` 로 선-치환한다. 즉 "redis 는 non-DB" 라는 이 테스트의 프레이밍은 (본 diff 가 만든 것이 아니라 기존부터 있던 네이밍이며, 이번 diff 는 assertion 값만 갱신) `redactSecrets` 단독 관점에서는 맞지만 실제 execution-engine 소비 경로 관점에서는 다소 혼동을 줄 수 있음. 이번 diff 범위 밖 — 조치 불필요, 참고로만 기록.

## 리뷰 포인트별 평가

1. **behavior-preserving 회귀 커버리지**: `mcp-error-codes.spec.ts` 가 `expect(out).toContain('https://***@mcp.example.com/rpc')` 로 정확히 pin — 종전 MCP 전용 패턴과 동일한 `scheme://***@host` 출력을 공용 패턴이 재현함을 exact-string 으로 검증한다. username/password 특수문자·긴 값 전용 케이스는 없지만 shared spec 쪽(`redis://u:p4ss@cache:6379`, `amqp://guest:s3cr3t@mq`, IPv6 `[::1]:8080`)이 스킴 다양성·특수 host 형태를 커버하므로 실질 갭은 작다. 콜론 포함 password 케이스만 위 INFO 항목으로 별도 지적.
2. **scheme 보존 assertion**: `sanitize-error-message.spec.ts` 가 `toContain('https://***@internal.example.com/path')`, `toContain('redis://***@cache:6379')`, `toContain('amqp://***@mq')` 로 정확히 pin. 종전 whole-mask 시절의 loose assertion(`toContain('internal.example.com/path')`, `not.toContain('p4ss')` 만) 은 diff 에서 모두 exact-string 으로 교체되어 잔재 없음.
3. **FP 가드 유지**: IPv6(`https://[::1]:8080/x`)·host:port(`http://localhost:3000/health`)·IPv6 host-only(`https://[::1]:8080/health`)·SSH shorthand(`git@github.com:org/repo.git`)·콜론 프로즈(`ratio was 3:4`)·`ey`-word JWT FP 케이스 모두 기존 `it.each` 로 유지되며, 신규 lookbehind(`(?<=:\/\/)`)/lookahead(`(?=@)`) 방식으로도 트레이스상 전부 무매치로 유지됨을 확인(로컬 실행도 통과).
4. **전 소비처 회귀**: 지정된 jest 패턴 30 suite/704 test 전부 통과. 커밋 메시지의 "34 suite/795 test" 는 이보다 넓은 범위(전체 스윗) 실행 결과로 보이며, 이번 리뷰에서 지정 패턴 밖의 추가 소비처(`interaction.service`, `ai-turn-orchestrator`, `retry-after`, `background-execution.processor`, `schedule-runner`)도 별도로 7 suite/179 test 통과 확인. exact-string assertion 깨진 곳 없음.
5. **취약 assertion**: 없음 — 이번 diff 로 오히려 loose(`toContain(host)`, `not.toContain(secret)`)에서 exact-string(`toContain('scheme://***@host...')`) 으로 강화됨. 취약해진 assertion은 발견되지 않음.

## 요약

공용 `SECRET_LEAK_PATTERNS` 의 URI-userinfo 패턴을 whole-mask 에서 scheme-preserving lookbehind/lookahead 로 바꾸고 MCP 전용 중복 패턴을 제거한 behavior-preserving 리팩터로, 두 spec 파일 모두 종전의 느슨한 `toContain(host)/not.toContain(secret)` assertion을 `toContain('scheme://***@host...')` exact-string pin 으로 교체해 오히려 검증 강도가 높아졌다. FP 가드(IPv6·host:port·SSH shorthand·콜론 프로즈)는 그대로 유지되고 정규식 변경 후에도 유효함을 코드 트레이스와 실행(30 suite/704 test + 보충 7 suite/179 test, 전부 통과)으로 확인했다. 유일한 갭은 password 세그먼트에 콜론이 포함된 케이스 — 정규식 리팩터의 부수효과로 (구 버전 대비) 마스킹 커버리지가 개선됐지만 이 개선이 테스트로 고정되어 있지 않다는 점이며, 나머지는 조치 불필요한 참고 사항이다.

## 위험도

LOW
