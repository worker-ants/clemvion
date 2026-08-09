# Rationale 연속성 검토 보고서

## 검토 범위 메모

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`. prompt 의 "Target 문서" 는 diff 가 아니라 `spec/conventions/` 전체(및 다수 cross-reference spec 파일)의 bundle 이며, 이 bundle 자체는 `origin/main` 대비 **변경되지 않았다** (`git diff origin/main...HEAD -- spec/conventions/` 결과 없음, `git diff --stat` 로 실측).
- 이 worktree(`backend-typecheck-gap-3d7a91`)의 실제 diff(38 files)는 `spec/**` 를 전혀 건드리지 않는다. 구성:
  1. **backend `*.spec.ts` 기계적 TS 정합 수정** 6건 — 누락 생성자 인자(`executions-rerun.service.spec.ts` 8번째 `workspacesService`, `integration-expiry-scanner.service.spec.ts` 8번째 `cafe24RefreshQueue`) 보강, 누락 import(`workflows.service.spec.ts` 의 `SaveCanvasDto`), 삭제된 파라미터 미러링(`slack-message.renderer.spec.ts` 의 `renderSlackEvent` 3번째 인자 제거), `execution-engine.service.spec.ts`. 모두 이미 프로덕션 타입이 요구하는 형태에 테스트 mock 을 맞추는 것뿐 — 설계 결정이 아니다.
  2. **`secret-resolver.service.ts` 신규 가드** — `deleteByPrefix(prefix)` 에 `LIKE` 메타문자(`%`/`_`/`\`) 거부 검사 추가 (+ 대응 unit 4종).
  3. **CI/harness 신설** — `.github/workflows/backend-checks.yml`(lint/unit/typecheck-ratchet 3-job 신설), `scripts/check-backend-typecheck-ratchet.py` + `scripts/backend-typecheck-baseline.json`(신규 ratchet), `.github/workflows/harness-checks.yml` paths 등재 2줄, `PROJECT.md` wrapper 4단계 밖 게이트 표 추가, `.claude/tests/test_backend_typecheck_ratchet.py`.
- 위 3범주 중 spec/conventions/ 의 Rationale 과 교차할 여지가 있는 것은 (2)뿐이라 이를 집중 검증했고, (3)은 참고로 기존 관례와의 정합만 확인했다 (본 checker 의 소관인 spec Rationale 이 아니라 harness 자체 설계라 발견사항엔 넣지 않음).

## 교차검증 상세

### (2) `secret-resolver.service.ts` — `deleteByPrefix` LIKE 메타문자 거부

- `spec/conventions/secret-store.md` 를 bundle 에서 전문 확인 (§1 URI scheme, §2 인터페이스, §2.1 호출 규약, §4 보안 요구사항 SS-SE-01~06, §5.3 사용 패턴, §6 cascade, Rationale R1~R5).
- `deleteByPrefix` 관련 기존 서술: §2.1 은 "trigger 삭제 시 `deleteByPrefix('secret://triggers/{id}/')` 로 일괄 삭제" 를 **권장**만 하고 prefix 의 문자 제약은 규정하지 않는다. §2.1.1 은 "`deleteByPrefix` 포함 전체 메서드 시그니처 안정화 전" 이라고만 명시 — 이번 변경은 시그니처(파라미터 개수/타입)를 바꾸지 않고 내부 유효성 검사만 추가했으므로 이 문구와 충돌하지 않는다.
- Rationale R1~R5 어디에도 "prefix 는 검증하지 않는다" 류의 명시적 결정이나, 이번 변경이 재도입하는 "기각된 대안" 이 없다. 오히려 §1 예시가 실제 호출부(`secret://triggers/{uuid}/`)와 정확히 일치하는 형태로만 쓰이고 있어, 새 가드가 문서화된 유일한 사용 패턴(§5.3)을 그대로 통과시킨다 (신규 unit `통과 — 실제 호출부 형태(내부 생성 UUID 경로)는 그대로 동작한다` 로 회귀 방지까지 확보).
- 결론: 이 변경은 **결정의 번복이 아니라 기존에 미명시였던 여백(LIKE 메타문자 처리)을 방어적으로 좁히는 순수 추가**다. `## 검토 관점`의 4개 렌즈(기각 대안 재도입 / 원칙 위반 / 무근거 번복 / invariant 우회) 어디에도 해당하지 않는다.

### (3) CI/ratchet 신설 — 기존 설계 원칙과의 정합 (참고, 본 checker 발견사항 아님)

- bundle 안에 이미 "왜 P2-b 는 hard fail 이 아닌 ratchet 인가"(`hardcoded-korean-ratchet.test.ts` Rationale, 6876행 부근)라는 선례가 있고, 그 근거("한 번에 0 화는 비현실적 → baseline 화이트리스트로 현재 수 이상 증가만 차단")를 이번 `check-backend-typecheck-ratchet.py` 가 그대로 재사용한다(스크립트 헤더 "왜 전면 승격이 아니라 ratchet 인가"). 상충 없이 기존 패턴을 확장한 사례.
- `harness-checks.yml` paths 등재 2줄 추가 근거 주석("판정 스크립트와 baseline 데이터 둘 다 등재해야 한다")은 memory 에 기록된 반복 결함 클래스("paths 커버리지 갭 6회")를 스스로 인용하며 동일 실패를 막는 방향이라 일관적이다.

## 발견사항

없음 — 4개 검토 관점(기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / invariant 충돌) 중 어느 것도 이번 diff 에서 관측되지 않았다.

## 요약

이번 `--impl-done` 요청의 실제 diff 는 `spec/conventions/` 문서를 전혀 변경하지 않으며, target 으로 제시된 bundle 도 `origin/main` 대비 무변경이다. worktree 의 실질 변경은 (a) backend `*.spec.ts` mock 시그니처/import 를 프로덕션 타입에 맞추는 순수 기계적 수정, (b) `secret-resolver.service.ts` 의 `deleteByPrefix` 에 LIKE 메타문자 거부 가드를 추가하는 방어적 보강(기존 `secret-store.md` §1/§2/§4/Rationale R1~R5 어디와도 충돌 없음 — 유일한 문서화된 호출 형태를 그대로 통과시키며 시그니처도 불변), (c) backend 타입체크 ratchet CI 신설(기존 `hardcoded-korean-ratchet` Rationale 이 세운 "점진적 baseline ratchet" 원칙을 그대로 재사용하고, `harness-checks.yml` paths 등재는 이 저장소가 반복 학습한 "paths 커버리지 갭" 교훈을 스스로 인용해 재발을 막는 방향). 네 가지 검토 관점(기각된 대안 재도입·합의 원칙 위반·무근거 번복·invariant 우회) 중 어느 것도 위반이 관측되지 않았다.

## 위험도
NONE
