# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `production-guards.spec.ts` — `jwtConfig` 직접 호출로 `registerAs` 래퍼 우회
  - 위치: `blacklist Set sync` describe 블록, `jwtConfig()` 호출부
  - 상세: 테스트가 `jwtConfig()` raw 함수를 직접 호출해 `registerAs` 래퍼를 우회한다. 인라인 주석에 이 사실이 문서화되어 있고 의도적 선택이므로 scope 위반은 아니다. 단, `jwt.config.ts` 의 반환 형태가 바뀌면 해당 테스트가 묵시적으로 깨질 수 있다.
  - 제안: 현재 주석 수준으로 충분. 필요 시 `jwtConfig` 반환 타입 고정 테스트를 별도 추가(본 PR 범위 밖).

## 요약

3개 파일 모두 커밋 메시지에 명시된 리뷰 반영 항목(SUMMARY#3/#7, INFO-12/13/17/18)에 정확히 대응한다. `README.md` 는 배포 경고 1줄 추가, `production-guards.spec.ts` 는 신규 테스트 추가 및 그에 필요한 import 만 추가, `production-guards.ts` 는 JSDoc `@throws`/`@param`/`@returns` 태그 추가뿐이다. 기존 코드 재포맷, 무관한 리팩토링, 불필요한 임포트, 설정 파일 변경은 없다. 변경 범위가 의도된 범위 내에 완전히 수렴한다.

## 위험도

NONE
