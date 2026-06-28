# Testing Review

## 발견사항

- **[INFO]** `nextE2eClientIp()` 헬퍼 자체에 대한 단위 테스트 부재
  - 위치: `codebase/backend/test/helpers/e2e-client-ip.ts`
  - 상세: 카운터 순환 로직(`(clientIpSeq % 254) + 1`)과 wraparound 동작(254 → 1)은 사소해 보이지만, 헬퍼가 여러 spec 파일에서 공유되므로 로직 회귀 시 전체 e2e 429 문제가 재발한다. JSDoc 에 동작이 잘 설명돼 있으나 정형 테스트는 없다.
  - 제안: unit 테스트가 없더라도 허용 가능하다. 헬퍼가 단순 순수 함수이고 e2e 스스로 254 미만 호출을 보장하므로 현재 리스크는 낮음. 다만 `clientIpSeq = 254`일 때 `nextE2eClientIp()` 가 `203.0.113.1`을 반환하는지 경계값 주석만 있으면 충분하다.

- **[INFO]** `webhook-trigger.e2e-spec.ts`의 공개(auth_config_id=NULL) 케이스(L, C, B 일부)에 `x-forwarded-for` 미설정
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts`, 케이스 L(`공개 webhook 32KB 초과`), B(`비활성 트리거` — 공개 trigger), C(`미존재 경로`)
  - 상세: plan 문서는 "webhook-trigger 의 공개 ~5건은 위 3개 수정 후 단독으로 10/분 한도 내"라고 분석하고 미수정을 의도적으로 결정했으며, 런이 green 으로 검증됐다. 현재 수정 범위·의사결정은 명확하다. 그러나 향후 공개 케이스가 추가되면 다시 collapse 문제가 재발할 수 있다.
  - 제안: `webhook-trigger.e2e-spec.ts`의 공개 경로 케이스들도 `nextE2eClientIp()`를 추가하는 것이 방어적으로 더 안전하다. 지금은 선택적 개선이지만 "latent ordering bomb" 재발 예방 측면에서 해당 케이스들에도 동일하게 적용하는 것을 권장한다.

- **[INFO]** Slack `url_verification` 테스트의 느슨한 assertion
  - 위치: `codebase/backend/test/chat-channel-slack.e2e-spec.ts`, L418 `expect([200, 401]).toContain(res.status)`
  - 상세: `inboundSigningRef` 설정 여부에 따라 200 또는 401 둘 다 허용하는 assertion 은 실제 어떤 경로가 실행됐는지 검증하지 않는다. 이는 기존 코드(이번 변경 이전부터)의 문제이며 이번 XFF 수정과 무관하다. 그러나 이 테스트가 회귀를 검출하지 못할 수 있다.
  - 제안: 이번 변경 범위 밖이지만 주의 요망. 가능하면 명확한 단일 상태코드 assertion 으로 개선 필요.

- **[INFO]** `inboundSigningRef` 설정된 Discord trigger 의 afterAll 정리 누락 가능성
  - 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts`, L189 `setupChatChannelTrigger` 인라인 setup
  - 상세: 테스트 케이스 내에서 `await db.query('DELETE FROM trigger ... ').catch(() => undefined)` 로 정리하고 있다. 테스트가 중간에 실패하면(`expect(res.status).toBe(401)` 실패 전에) DELETE 가 실행되지 않아 trigger row 가 잔류할 수 있다. 이는 이번 변경 이전부터의 패턴으로 XFF 추가와 무관하다.
  - 제안: `try/finally` 패턴 또는 `afterEach` 를 활용한 cleanup 으로 개선하면 테스트 격리가 강화된다. 현재 범위 밖이지만 중요도는 낮음(e2e 환경 DB 재생성 가정).

- **[INFO]** Jest 파일별 모듈 격리 의존성 명시적 검증 없음
  - 위치: `codebase/backend/test/helpers/e2e-client-ip.ts` JSDoc 설명
  - 상세: Jest의 파일별 모듈 레지스트리 격리(`--runInBand` 여부, `--maxWorkers` 설정)에 따라 카운터 공유 여부가 달라질 수 있다. JSDoc 에 이 동작을 설명하고 있으나, Jest 설정이 `--runInBand`(직렬)로 변경되거나 worker 공유가 발생하면 카운터가 같은 프로세스 내에서 누적될 수 있다.
  - 제안: jest 설정 파일에 `--isolateModules` 또는 파일별 격리 설정을 명시적으로 기록해두거나, 헬퍼의 JSDoc 에 현재 jest 설정 의존성을 명시하면 좋다. 현재 리스크는 낮음(파일당 호출 수 « 254 이며 254 wraparound 방어 포함).

## 요약

이번 변경의 핵심은 `nextE2eClientIp()` 공유 헬퍼 신설과 공개 webhook e2e 요청에 고유 XFF 헤더를 부여하는 것으로, 목적·구현·적용 범위 모두 명확하다. RFC 5737 TEST-NET-3 대역 선택, 카운터 wraparound, Jest 파일별 격리 활용은 올바른 설계 결정이다. 변경된 테스트들은 독립 실행 가능하고 의도가 명확하며, 각 케이스별 XFF 추가는 일관성 있게 적용됐다. `webhook-trigger.e2e-spec.ts`의 공개 케이스들에 XFF 를 적용하지 않은 것은 의도적 결정이고 런으로 검증됐으나, 향후 공개 케이스 증가 시 동일 문제가 재발할 수 있는 latent 위험이 남아있다. 전체적으로 테스트 인프라 fix 로서 적절하며 Critical·Warning 발견사항 없음.

## 위험도

LOW
