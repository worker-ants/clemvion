// `engine-error-code-anchor-guard.ts` 의 **형태 커버리지** 픽스처. 실행되지 않는다.
//
// ## 왜 라이브 소스가 아니라 픽스처인가
//
// 처음에는 "정규식이 놓쳤던 `const code = 'X'` 형태를 수집하는가" 를 **라이브 소스**로
// 단언했다. 그런데 그 형태를 없애는 것이 이 가드의 목적이므로, 가드가 성공하는 순간
// 자기 테스트의 대상이 사라진다 — 실제로 첫 실행에서 그렇게 RED 가 났다.
//
// 형태 커버리지는 **불변인 픽스처**로 고정한다. 라이브 소스에 대한 단언은
// "앵커 없는 코드가 0건" 하나면 충분하고, 그건 픽스처와 독립이다.
//
// 여기 값들은 어느 enum 에도 없는 **가짜 코드**다(`FIXTURE_` 접두). 실제 코드와 겹치면
// 픽스처가 라이브 카탈로그에 의존하게 된다.

/* eslint-disable @typescript-eslint/no-unused-vars */

// ① 객체 속성
const objectForm = {
  code: 'FIXTURE_OBJECT_FORM',
};

// ② 변수 선언 — 1차 정규식 스캔이 통째로 놓쳤던 형태
const code = 'FIXTURE_VARIABLE_FORM';

// ③ 클래스 필드 (`readonly … as const`)
class FixtureError extends Error {
  readonly code = 'FIXTURE_CLASS_FIELD_FORM' as const;
}

// ④ 대입
const target: { code?: string } = {};
target.code = 'FIXTURE_ASSIGNMENT_FORM';

// 대조군 — UPPER_SNAKE 가 아니므로 수집되면 안 된다(오탐 축).
const notACode = { code: 'lower_snake_value' };
// 대조군 — 바인딩 이름이 다르므로 수집되면 안 된다.
const otherName = { status: 'FIXTURE_WRONG_BINDING' };

export { objectForm, code, FixtureError, target, notACode, otherName };
