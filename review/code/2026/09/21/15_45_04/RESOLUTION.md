# RESOLUTION — 15_45_04 (라운드 2, 수렴)

**Critical 0 · Warning 0.** 착수 전 선언한 정지 규칙(«Critical·Warning 0 인 라운드, 또는
`codebase/**` 수정 0 인 라운드»)의 **첫째 절**로 수렴했다.

Warning 이 0 이라 조치 항목은 없지만, SUMMARY 상단의 «병합 전 확인 필요» 경고는 **병합을
막는 형태의 주장**이므로 확인 결과를 남긴다.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| (상단 경고) security 관측 — 워킹트리에 `if (affected === 0)` → `if (!affected)` 미커밋 뮤테이션 | 확인 | 무수정 | **실측으로 부정됐다.** `git show HEAD:…/auth-configs.service.ts` 와 워킹트리 파일 **둘 다 `:327` 이 `if (affected === 0) this.throwAuthConfigNotFound();`** 이고, `git status --short` 는 이번 라운드 산출 디렉터리(`review/code/2026/09/21/15_45_04/`)만 미추적으로 보고한다. 라운드 1 조치(`resolution-applier`) 중의 일시적 상태이거나, `_resolution_log.md` 에 기록된 뮤테이션 이력을 라이브 상태로 오인한 것으로 본다. **리뷰어의 권고 1번(«병합 직전 재확인»)은 이 항목으로 이행했다.** |
| INFO 1 (ORM hook 서술이 문자 그대로는 부정확) | 유예 | 무수정 | «저장소 전체 lifecycle hook 0건» 이 `User` 의 `@BeforeInsert` 때문에 문자 그대로는 넓다. **다만 전환 안전성의 근거로 필요한 것은 remove 계열 훅이고 그것은 0건**이라 결론은 유효하다. 고치면 `codebase/**` 가 다시 바뀌어 라운드가 한 번 더 도는데, 이 라운드가 Warning 0 으로 수렴한 직후다 — `developer` SKILL §수렴 예외 (a)(b). 트래커 대신 이 자리에 남긴다: 다음에 이 주석을 만질 때 «AuthConfig 관련 remove/soft-remove 훅·subscriber 0건» 으로 좁힐 것. |
| INFO 6 (주석이 세션-스코프 리뷰 번호 «리뷰 INFO 1» 인용) | 유예 | 무수정 | 타당한 지적이다 — 세션 식별자 없는 번호는 시간이 지나면 모호해진다. 위 INFO 1 과 같은 자리·같은 이유로 함께 유예한다(한 번의 편집으로 둘 다 처리하는 편이 싸다). |
| INFO 2·3·4·5·7·8·9·10·11·12·13 | 확인 | 무수정 | 긍정 확인이거나, 라운드 1 에서 근거와 함께 유예를 확정한 항목의 재확인이다(선행 `findById` fail-fast · mock 의 `workspaceId` 스코프 · e2e 헬퍼 추출 · 이름 근접 · 비트랜잭션 감사). |

## TEST 결과

- lint  : 통과
- unit  : 통과
- build : 통과 (백엔드 타입체크 ratchet 포함)
- e2e   : 통과 (375/375, `_test_logs/e2e-20260921-153915.log`) — 라운드 1 조치 직후 전 단계
  재수행한 결과이고, 이 라운드의 조치는
  `review/**` 뿐이라 `codebase/**` 는 그때와 동일하다.

## 보류·후속 항목

- INFO 1·6 — 위 표에 근거와 함께 기록. 다음에 `remove()` 주석을 만질 때 한 번에 처리.
- INFO 4 — 동시성 e2e 헬퍼 추출. **여덟·아홉 번째(model-config · webauthn)** 시점에 재검토.
  일곱 파일 중 하나만 손대면 비대칭이 된다는 것이 유예 사유다.
- INFO 3 — auth-configs 모듈 전체의 cross-tenant negative 테스트 부재(선재 관례).
