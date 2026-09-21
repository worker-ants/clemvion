# 문서화(Documentation) 리뷰 — `member-dup-remove` (`WorkspacesService.removeMember()` 동시 삭제 감사 중복 수정)

## 발견사항

- **[WARNING]** API 계약 변경(동시 DELETE 진 쪽 404)이 그 엔드포인트의 소유 spec 문서에는 아직 반영되지 않았다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` (diff 게이트 `822`~`831`, `const { affected } = await this.memberRepository.delete(...)` ~ `throw new NotFoundException(...)`)
  - 상세: 이 변경으로 `DELETE /api/workspaces/:id/members/:memberId` 는 동시 요청 두 건 중 진 쪽에 `404 MEMBER_NOT_FOUND` 를 새로 반환하게 된다(종전엔 둘 다 200 이었다 — plan §B). 그런데 이 엔드포인트를 서술하는 `spec/2-navigation/9-user-profile.md §6.1` 과 `spec/data-flow/12-workspace.md §1.6` 은 여전히 "멤버 제거 (Admin+ / 자가 탈퇴 시 leave로 위임)"만 적고 동시 요청 시 진 쪽이 404 를 받는다는 사실을 언급하지 않는다. 코드 주석(`workspaces.service.ts:806-821`)과 e2e 테스트 JSDoc(`member-remove-concurrency.e2e-spec.ts:12-30`)에는 이 계약이 정확하고 상세하게 문서화돼 있지만, API 문서 쪽(spec)엔 아직 반영되지 않았다.
  - 참고: 이 갭은 형제 다섯 PR(#1369~#1372)에서 이미 다섯 차례 반복 관찰된 동일 패턴이고, 이번 diff 자체(`plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 `4891`~`4893`)가 `9-user-profile.md §6.1`·`data-flow/12-workspace.md §1.6` 를 트래커 서술-부재 목록에 새로 등재해 두었다 — 즉 "고치지 않은 채 두었다"가 아니라 "코드 PR과 spec 갱신을 분리하는 기존 관례를 따라 후속 planner 턴으로 명시적으로 넘겼다"에 가깝다. 이미 `/consistency-check --impl-prep`(`review/consistency/2026/09/21/12_23_48`)가 cross_spec·rationale_continuity·plan_coherence 세 checker 교차로 WARNING 처리했고 BLOCK 사유는 아니라고 판정했다. 문서화 관점에서도 독립적으로 같은 결론(비차단, 그러나 실재하는 API 문서 부채)에 도달한다.
  - 제안: 이번 PR 자체를 막을 사유는 아니다. `spec/5-system/2-api-convention.md §3` 각주 작업을 집행할 때 `9-user-profile.md §6.1`·`data-flow/12-workspace.md §1.6` 두 자리를 함께 갱신하도록 트래커 항목이 이미 잡아 두었으므로, 그 실행이 누락되지 않게 확인만 하면 된다.

- **[INFO]** `removeMember()` 의 한 줄 JSDoc 이 새로 도입된 동시성 계약을 요약하지 않는다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()` 바로 위 JSDoc (`/** 멤버 제거(Admin+). 자기 자신 제거는 \`leaveWorkspace\`로 위임해 동일한 가드를 적용한다. */`)
  - 상세: 같은 파일의 `assertWorkspaceDeletable()`·`transferOwnership()` 은 JSDoc 안에 "동시성 보장" 절을 두어 락 순서·판정 근거를 요약한다. `removeMember()` 는 그 설명을 (품질은 매우 높지만) 메서드 본문 인라인 주석으로만 갖고 있어, 시그니처만 보는 독자는 동시 요청 시 진 쪽이 404 를 받는다는 사실을 바로 알기 어렵다.
  - 제안: 필수는 아니나, 한 문장("동시 제거 요청 중 진 쪽은 원자적 DELETE 의 `affected===0` 판정으로 404 를 받는다")을 JSDoc에 추가하면 다른 두 메서드와 문서화 밀도가 맞는다.

## 확인한 항목 (문제 없음)

- **주석 정확성**: 삭제된 `remove(member)` 호출과 함께 그 위에 있던 stale 주석(`// remove() 는 in-memory id 를 지우므로 감사용으로 미리 캡처한다.`)도 정확히 함께 제거됐다 — 새 코드 경로에 맞지 않는 주석이 남지 않았다.
- **인라인 주석 품질**: `workspaces.service.ts:806-821` 의 새 주석 블록은 (a) 왜 락을 새로 들이지 않았는지, (b) `affected===0` 명시 비교가 왜 필요한지(`null`/`undefined` 오판 방지), (c) 이 판정이 owner 승격 TOCTOU 를 닫지 않는다는 것과 그 이유까지 명시한다. 인용된 `rewriteTriggerConfigLocked` 의 "같은 규율"도 실제 코드(`trigger-config-lock.ts:246-247`, `result.affected === 0` 명시 비교 + null/undefined 미판정)와 일치함을 확인했다 — 근거 없는 인용이 아니다.
- **테스트 문서화**: `workspaces.service.spec.ts` 의 새 `describe('removeMember — 동시 제거')` 블록과 신규 e2e 스펙(`member-remove-concurrency.e2e-spec.ts`)은 각 테스트 자리마다 판별력(무엇을 검증하고 무엇을 가르는지)을 JSDoc/인라인 주석으로 남겼다. 특히 `it.each([[undefined], [null]])` 대조군 위의 주석(라인 1512-1517 게이트)은 #1371 에서 이 대조군이 빠져 뮤턴트 32건이 통과했다는 근거까지 남겨 "왜 이 테스트가 필요한가"를 다음 사람에게 알려준다.
- **spec.ts 기존 mock 관련 주석**: 라인 1290-1291 게이트의 "공유 mock 기본값은 `deleteWorkspace` 의 cascade 용 `{affected: 0}`" 주석을 실제 `beforeEach` 설정(`workspaces.service.spec.ts:145-147`, `memberRepo.delete` 기본값 `{affected: 0}`)과 대조 확인 — 정확하다.
- **README/CHANGELOG/설정 문서**: 새 환경변수·설정 옵션·공개 API 형태 변경 없음(에러 코드·응답 shape·엔드포인트 모두 기존 재사용, `naming_collision.md` 확인과 일치). README·CHANGELOG 갱신 필요 없음 — 본 저장소는 CHANGELOG 대신 `plan/complete/`를 이력으로 쓰는 관례이고, 이번 plan(`member-dup-remove.md`)이 그 역할을 충분히 수행한다.
- **plan 문서 자체의 품질**: `plan/in-progress/member-dup-remove.md` 는 형제 다섯 PR과의 관계, 전수 조사 방법론, 재현 레시피, 유예 사유(owner TOCTOU)를 모두 실측과 함께 기록해 문서화 품질이 높다. `spec-draft-nullable-notation-followups.md` 트래커 갱신도 새로 발견된 3개 잔여 자리(`auth-configs`·`model-config`·`webauthn`)의 위치(`auth-configs.service.ts:287`, `model-config.service.ts:404`, `webauthn.service.ts:532` — 실제 경로는 `auth/webauthn/webauthn.service.ts`)를 코드와 대조해 정확함을 확인했다(`webauthn.service.ts:532` 가 실제로 `credentialRepo.delete({ id: credentialUuid })` 로 `affected` 를 버리는 자리임을 확인).
- **리뷰/검토 산출물(파일 6~13, `review/consistency/2026/09/21/12_23_48/*`)**: 자동 생성된 consistency-check 산출물이며 그 자체가 코드가 아니라 감사 문서다. 내부 인용(예: `rewriteTriggerConfigLocked`, 형제 PR 번호, spec 절 번호)을 표본 검증했고 조작·오인용은 발견되지 않았다.

## 요약

이 diff 는 문서화 관점에서 전반적으로 높은 수준이다 — 새로 추가된 동시성 판정 로직에는 "왜"를 설명하는 상세한 인라인 주석이 붙어 있고, 옛 주석은 정확히 함께 제거됐으며, 신규 단위/e2e 테스트는 각 케이스의 판별력을 스스로 문서화한다. 유일하게 남는 실질적 문서 갭은 `DELETE /api/workspaces/:id/members/:memberId` 의 동시-요청 계약 변경(진 쪽 404)이 그 엔드포인트를 서술하는 spec 문서(`9-user-profile.md §6.1`, `data-flow/12-workspace.md §1.6`)에는 아직 반영되지 않았다는 것인데, 이는 이번 diff가 스스로 트래커에 등재해 후속 planner 턴으로 넘긴 항목이라 신규 발견이라기보다 재확인에 가깝다. `removeMember()` JSDoc 이 형제 메서드만큼 동시성 계약을 요약하지 않는 점은 사소한 개선 여지다.

## 위험도

LOW
