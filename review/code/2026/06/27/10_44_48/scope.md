# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] loader.ts — 루프 변수명 변경 (`call` → `queuedCall`)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` replay 루프 내
- 상세: `for (const call of queued)` 를 `for (const queuedCall of queued)` 로 rename 하고, 이어서 `const item = queuedCall as unknown` 을 도입한다. 기능 변경과 동일 블록에 포함돼 있어 이 rename 자체는 별도 커밋이 아니지만, 원래 `call` 이 불명확한 이름이 아니었으므로 엄밀히는 요청 외 스타일 변경이다.
- 제안: 실질적 영향은 없으며 변경 코드 블록 내에서 이루어지므로 차단 필요는 없다. 향후 리팩터링 변경은 별도 커밋으로 분리하는 관행을 권장한다.

### [INFO] loader.ts — 상세 주석 블록 추가
- 위치: `installGlobal` 함수 내 replay 루프 직전
- 상세: 4줄짜리 한국어 주석이 새로 추가됐다. 내용은 `arguments` 객체가 `Array.isArray` 에 걸리는 이유·spec 참조(2-sdk §1·R5)를 설명하며 버그 재발 방지 맥락으로 적절하다.
- 제안: 버그 수정 의도와 직결된 설명이므로 범위 이탈로 보지 않는다.

### [INFO] loader.spec.ts — `type GlobalCall` 임포트 추가
- 위치: 파일 첫 번째 import 라인
- 상세: 신규 회귀 테스트에서 `stub.q = [bootArgs, openArgs] as unknown as GlobalCall[]` 타입 캐스팅에 직접 사용되므로 필요한 임포트다.
- 제안: 사용처가 명확하며 불필요한 임포트 정리나 추가가 아니다.

## 요약

변경의 핵심인 `loader.ts` replay 루프의 `Array.isArray` 제거 + length 기반 array-like 수용 로직, `loader.spec.ts` 회귀 테스트 추가, 그리고 `plan/complete/` 완료 플랜 문서 신규 생성 — 세 파일 모두 "arguments 객체 replay 버그 수정" 이라는 단일 목적에 집중돼 있다. 루프 변수명 rename은 동일 블록 내에서 이루어졌고, 설정 파일·무관한 모듈·포맷팅 변경은 전혀 없다. 전반적으로 범위 초과 없이 의도한 버그 픽스와 그 검증에 국한된 변경이다.

## 위험도

NONE
