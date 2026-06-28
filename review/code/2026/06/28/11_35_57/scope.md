# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 테스트가 실제 프로덕션 CORS 설정 객체가 아닌 로컬 픽스처를 검증함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/codebase/backend/src/common/cors/web-chat-cors.spec.ts` — 신규 `describe('CORS exposedHeaders 스냅샷 (AGM-13 회귀 방지)')` 블록 (라인 239–255)
- 상세: 테스트 내부에서 `defaultOptions` 함수를 직접 정의하고(`exposedHeaders: ['X-Deleted-Count']` 하드코딩), 그 결과를 assert 한다. 실제 `web-chat-cors.ts` 에서 export 하거나 애플리케이션이 주입하는 `defaultOptions` 를 가져와 검증하는 것이 아니라 픽스처를 만들어 자기 자신을 검증하는 구조다. 따라서 실제 프로덕션 CORS 설정에서 `exposedHeaders` 가 제거되거나 이름이 바뀌어도 이 테스트는 통과한다. **범위 위반은 아니지만** 회귀 방지 효과가 의도보다 약하다.
- 제안: 실제 모듈이 export 하는 `defaultOptions` 팩토리(또는 그것이 생성하는 옵션)를 import 해서 검증하거나, `web-chat-cors.ts` 의 실제 값을 참조하도록 수정하면 회귀 탐지력이 높아진다. 단 이 문제는 테스트 품질 이슈로서 본 커밋의 "범위 일탈"에 해당하지 않으며, 리뷰 결론에는 영향을 주지 않는다.

---

## 요약

커밋 `5343b08e9`는 2개 파일만 변경했으며, 변경 내용 모두 이전 리뷰(INFO-4/11/15/18/19) 에서 지적된 AGM-13 `X-Deleted-Count` 명세 보강과 CORS 회귀 테스트 추가에 직접 대응한다. spec 변경은 테이블 셀 중복 정리·AGM-13 요구사항 ID 강화·Rationale 신규 절 추가로 모두 해당 요구사항 범위 안에 국한되어 있고, 무관한 spec 섹션·다른 파일·포맷팅·주석은 변경되지 않았다. 테스트 파일에서 픽스처 기반 assert 방식은 테스트 유효성 측면의 약점이지만 범위 일탈은 아니다. 전체적으로 의도된 변경 범위를 정확히 준수하고 있다.

## 위험도

NONE
