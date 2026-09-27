# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 트래커 문서가 아직 존재하지 않는 `plan/complete/folders-contract-e2e.md` 를 인용한다 (댕글링 전방 참조, 아직 미해소)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1398` (`FolderDto(`plan/complete/folders-contract-e2e.md` — 폴더 e2e 신설. …)`)
  - 상세: 실측 확인 결과 이 시점(`HEAD=1b3cb2543`)에도 `plan/complete/folders-contract-e2e.md` 는 저장소에 존재하지 않는다(`find plan -iname '*folders-contract*'` → `plan/in-progress/folders-contract-e2e.md` 1건만 나옴). 해당 plan 파일의 frontmatter 도 `status: in-progress` 이고, 체크리스트 마지막 두 항목(`- [ ] /ai-review`, `- [ ] --impl-done`)이 아직 미체크다. 이 프로젝트 관례상 체크박스 완료와 `plan/complete/` 이관(`git mv`)은 "한 동작"으로 마무리 커밋에서 함께 일어난다(`feedback_plan_checkbox_actual_state.md`). 이 항목은 직전 리뷰 라운드(`review/code/2026/09/27/11_53_51`)의 documentation reviewer 가 이미 W2 로 지적했고, `RESOLUTION.md` 는 "마무리 커밋이 그 경로를 만든다 — push 전 `git show HEAD:plan/complete/folders-contract-e2e.md` 로 확인" 이라고 처분해 두었다. 즉 **새로 발견한 결함이 아니라 이미 추적 중인 항목이며, 지금 이 라운드 자체가 그 마무리 커밋보다 먼저 도는 `/ai-review` 단계라 아직 해소되지 않은 것이 정상 순서다.** 다만 이 시점 스냅샷 기준으로는 여전히 죽은 링크이므로, 마무리 커밋이 실제로 실행되지 않으면 이 인용은 영구히 존재하지 않는 경로를 가리키게 된다.
  - 제안: 새 조치 불필요 — 기존 RESOLUTION 의 처분(마무리 커밋에서 `git mv` + 체크박스 완료 + push 전 `git show HEAD:plan/complete/folders-contract-e2e.md` 확인)을 그대로 수행하면 된다. 이번 라운드에서 별도 fix 커밋을 만들 필요는 없다.

## 확인한 항목 (문제 없음)

- **독스트링/JSDoc**: `omit-undefined.ts` 의 JSDoc 이 이유(`useDefineForClassFields`)·증상(키 부재/거짓 null)·실제 발생 자리(`triggers`, `folders`)를 모두 정확히 서술한다. `tsconfig.json` 의 `target: "ES2023"` 를 직접 확인해 JSDoc 인용이 맞음을 검증했다.
- **주석 정확성**: `folders.service.ts` `update()` 의 주석("빼지 않으면 `sortOrder` 가 응답에서 사라지고 하위 폴더의 `parentId` 가 null 로 실렸다")과 `triggers.service.ts` 의 동등 주석 모두 실제 코드·헬퍼 JSDoc과 어긋남 없이 일치한다. `folder-crud.e2e-spec.ts` 의 테스트 라벨(`it('C. …')`, `it('E. …')`)도 서비스 주석이 인용하는 "e2e C · E" 와 실제로 일치한다(교차 확인함).
- **CHANGELOG**: 신설 항목이 `CHANGELOG.md` 상단 기준 1번("API 응답 · OpenAPI 로 광고하는 계약의 변화")에 정확히 부합하고, 착수 때 세웠다가 e2e 뮤턴트로 반증된 "POST 응답 parentId 키 부재" 전제를 항목에 다시 싣지 않아 정확하다.
- **래칫 문서**: `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열에는 항목 수를 언급하는 stale 주석이 없어, 한 줄 제거가 다른 주석과 어긋나지 않는다.
- **README/설정 문서**: 새 환경변수·설정·배포 변경이 없고, 기존 백엔드에는 API 엔드포인트별 정적 README/OpenAPI 파일이 없다(Swagger 는 데코레이터로 런타임 생성) — README·별도 API 문서 갱신 불필요.
- **예제 코드**: `omit-undefined.spec.ts` 가 falsy 보존·불변성·얕은 복사·클래스 필드 own-property 4가지 사용 시나리오를 보여줘 예제로도 충분히 기능한다.
- **`type: String` 워크어라운드**: `folder-response.dto.ts` 의 `parentId` 에만 있는 인라인 주석(§5.4 기본형 + `type: object` 누출 방지)이 자체 완결적으로 이유를 설명하며, `spec/conventions/swagger.md` §192 에 이미 유사 관용구(엔티티 패스스루 필드에 `type: String` 명시)가 문서화돼 있어 완전히 새로운 패턴은 아니다.

## 요약

이번 변경은 문서화 관점에서 전반적으로 높은 수준을 유지한다 — 헬퍼 추출(`692f1e8fd`)로 두 서비스에 흩어져 있던 장문 rationale 을 `omit-undefined.ts` JSDoc 한 곳에 모으고 호출부 주석은 그 JSDoc 을 참조하도록 줄인 것은 직전 리뷰 W1 처분이 문서 유지보수 부담도 함께 줄인 좋은 사례다. CHANGELOG·DTO 주석·테스트 JSDoc 모두 실제 코드·실측(e2e 뮤턴트)과 정확히 일치한다. 유일한 흠은 트래커 문서의 `plan/complete/folders-contract-e2e.md` 댕글링 참조인데, 이는 새 결함이 아니라 직전 라운드에서 이미 식별·처분된 항목이 아직 예정된 마무리 커밋 이전 시점이라 자연스럽게 남아 있는 상태다 — 마무리 커밋에서 처리되는지만 push 전에 재확인하면 된다.

## 위험도
LOW
