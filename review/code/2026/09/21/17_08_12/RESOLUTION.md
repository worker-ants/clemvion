# RESOLUTION — 17_08_12 (라운드 2, 수렴)

**Critical 0 · Warning 0.** 착수 전 선언한 정지 규칙(«Critical·Warning 0 인 라운드, 또는
`codebase/**` 수정 0 인 라운드»)의 **첫째 절**로 수렴했다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| INFO 5 (정정 근거의 줄 번호 오프바이원) | 문서 | 아래 마무리 커밋 | **실측으로 확인하고 고쳤다.** 세 문서(`CHANGELOG.md` · `modelconfig-dup-delete.md` · `spec-draft-nullable-notation-followups.md`)가 «캐시 무효화 통지 중복은 과장이었다» 의 근거로 `llm.service.ts:81` 을 인용하는데, `:81` 은 **리스너 선언**이고 `clearClientCache(configId)` 호출은 `:82` 다. 세 곳 모두 `:81-82` 로 정정했다. — 과장을 정정하면서 그 정정의 근거 자체가 한 줄 어긋나 있었다는 점이 이 항목의 요지다. 전부 `codebase/**` 밖이라 게이트 freshness 에 영향 없다. |
| INFO 1 (architecture, 판별자 관용구가 8개 서비스에 복제) | 유예 | — (무수정) | **이번 PR 을 막을 사유가 아니라고 리뷰 본문 자체가 명시**했다. 유예가 아니라 **결정 시점을 고정**해 처리한다 — `plan/in-progress/modelconfig-dup-delete.md` 의 «이 PR 이 하지 않는 것» 이 이미 아홉 번째(WebAuthn) PR 에 «착수 시점에 e2e 헬퍼 추출 여부를 결정하고 plan 에 적을 것» 을 선행 조건으로 못박았고, 거기에 **`affected` 판별자 유틸(`isDeleteMiss()` 류) 최소 추출 검토도 함께** 얹는다. 아홉 번째가 **마지막 자리**이므로 그때가 추상화를 판단할 마지막이자 최적 시점이다. |
| INFO 2 (e2e 구조 중복) | 처리됨 | `01c6130f5` | 라운드 1 WARNING 3 을 결정-고정으로 처리한 것의 재확인. 재-flag 불요. |
| INFO 3 (진 쪽 테스트가 `delete` 호출 인자를 단언하지 않아 승자 테스트와 비대칭) | 유예 | — (무수정) | 타당한 지적이다. 다만 `codebase/**` 수정이라 고치면 라운드가 한 번 더 도는데, 이 라운드가 **Warning 0 으로 수렴한 직후**다 — `developer` SKILL §수렴 예외 (a)(b). 진 쪽 테스트는 이미 `affected: 0` 을 **주입**해 분기를 고정하므로 인자 단언이 없다고 공허하지 않다(승자 테스트가 같은 인자를 이미 단언한다). 아래 «보류» 에 남긴다. |
| INFO 4 (`as unknown as DeleteResult` 캐스트가 불필요해 보인다) | 유예 | — (무수정) | **불필요하지 않을 가능성이 높다** — 직전 PR(#1374)에서 타입체크 ratchet 이 바로 이 형태를 두 번 잡았고(`affected: null\|undefined` 는 `DeleteResult` 의 `number` 에 대입되지 않는다), 그래서 mock 팩토리에 `Promise<DeleteResult>` 를 명시한 것이다. 제거하려면 ratchet 을 돌려 확인해야 하고 그것은 `codebase/**` 수정이다. INFO 3 과 함께 다음 편집에서 처리한다. |
| INFO 6·7·8 | 확인 | — | 기존 컨벤션의 재확인이거나 긍정 확인. 조치 불요. |

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260921-165241.log`)
- unit  : 통과 (`_test_logs/unit-20260921-165341.log`)
- build : 통과 (`_test_logs/build-20260921-165515.log`, 백엔드 타입체크 ratchet 포함)
- e2e   : 통과 (376/376, `_test_logs/e2e-20260921-170154.log`) — 라운드 1 조치 직후 전 단계
  재수행한 결과이고, 이 라운드의 조치는 `CHANGELOG.md`·`plan/**`·`review/**` 뿐이라
  `codebase/**` 는 그때와 동일하다.

## 보류·후속 항목

- INFO 3 — 진 쪽 단위 테스트에 `expect(mockRepo.delete).toHaveBeenCalledWith({id, workspaceId})` 추가.
- INFO 4 — `as unknown as DeleteResult` 캐스트 제거 가능 여부를 **타입체크 ratchet 으로 실측**해 판단.
  («불필요해 보인다» 는 관찰이지 실측이 아니다 — #1374 가 그 반대를 실측했다.)
- INFO 1 — `affected` 판별자 유틸 최소 추출. **아홉 번째(WebAuthn) PR 착수 시점의 결정 대상**으로
  e2e 헬퍼 추출과 함께 묶었다.
