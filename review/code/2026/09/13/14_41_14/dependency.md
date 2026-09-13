# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** `guide-error-code-existence.test.ts` → `guide-identifier-existence.test.ts` 리네임 후, `guide-sanitized-message-parity.test.ts` 의 docstring 이 여전히 옛 파일명을 "자매(sibling)"로 인용한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` — `* 자매 \`guide-error-code-existence.test.ts\` 는 **코드 토큰**의 실재를 본다.`
  - 상세: 본 PR 은 `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 를 삭제하고 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 로 대체한다(파일 2~5). plan 문서(`plan/in-progress/guide-identifier-existence.md` §명명 절)는 "자매 `guide-sanitized-message-parity` 는 스코프가 안 바뀌므로 리네임 대상이 아니다"라고 명시적으로 그 파일 자체는 건드리지 않기로 결정했지만, 그 파일 **안의 크로스 레퍼런스 주석**이 이제 존재하지 않는 파일명을 가리키게 된 점은 처리되지 않았다. 코드 실행에는 영향이 없는 순수 주석이지만, "내부 모듈 간 의존 관계" 표기가 깨져 다음 사람이 `guide-error-code-existence.test.ts` 를 찾다가 없는 것을 결함으로 오인하거나("리네임이 불완전했다"는 재조사) 반대로 실재 파일(`guide-identifier-existence.test.ts`)을 못 찾을 수 있다. grep 결과 코드베이스 내 이 파일이 유일한 잔여 참조다(`grep -rn "guide-error-code" codebase/`).
  - 제안: 같은 주석 줄을 `guide-identifier-existence.test.ts` 로 갱신(또는 리네임 이력을 각주로 병기). PROJECT.md·트래커 문구는 이미 이 PR 이 갱신했으므로(plan 체크리스트) 동일 기준을 이 파일에도 적용하면 된다.

- **[INFO]** 새 외부 패키지 추가 없음 — 확인됨.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` (전체)
  - 상세: 신규·변경 파일의 import 는 `vitest`(기존 devDependency) · `node:fs` · `node:path`(Node 내장) · 동일 디렉터리의 기존 내부 유틸(`./tree-walk`, `./impl-anchor-parse`)과 이번 PR 이 함께 추가한 sibling 모듈(`./guide-identifier-scan`)뿐이다. `package.json`/lockfile 변경이 diff 에 없음을 확인했다(리뷰 대상 파일 목록 15개 중 매니페스트 없음). 버전 고정·라이선스·취약점·번들 크기 항목 전부 해당 없음(N/A) — 새 의존성이 없으므로.

## 요약

이번 변경은 순수 내부 test/tooling 리팩터(에러 코드 전용 가드 `guide-error-code-*` 를 식별자 전반 가드 `guide-identifier-*` 로 스코프 확장 + 리네임)이며, `package.json`/lockfile 수정이나 신규 외부 패키지 도입이 전혀 없다. 사용된 import 는 전부 Node 내장 모듈·기존 devDependency(vitest)·동일 폴더 내부 유틸(신규 sibling 파일 1개 포함)로, 버전 고정·라이선스·취약점·번들 크기·기존 의존성과의 충돌 관점에서 지적할 사항이 없다. 유일한 흠은 내부 의존성(모듈 간 상호 참조) 축에서 발견된 것으로, 리네임되지 않기로 결정된 인접 테스트 파일(`guide-sanitized-message-parity.test.ts`)의 주석이 삭제된 옛 파일명을 여전히 "자매"로 인용하고 있어 크로스 레퍼런스가 깨졌다 — 기능에는 영향 없는 문서적 결함이다.

## 위험도

NONE
