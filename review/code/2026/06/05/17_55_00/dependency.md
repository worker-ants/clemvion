# 의존성 리뷰 — memory-tokenizer-exact (A4 lite)

대상 diff: `cbfbfbb9..HEAD` (commit 8bb98865)
검토일: 2026-06-05
범위: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` + `.spec.ts`

---

## CRITICAL

해당 없음.

---

## WARNING

해당 없음.

---

## INFO

- **[INFO] 외부 의존성 변경 0건 확인**
  - 위치: `codebase/backend/package.json`, 모노레포 전체 `package.json` (6개), 모든 lockfile
  - 상세: `package.json` 및 `package-lock.json`/`yarn.lock`/`pnpm-lock.yaml` 에 변경 없음. `git diff cbfbfbb9..HEAD --name-only` 에 의존성 파일이 포함되지 않는다.
  - 제안: 현재 상태 유지.

- **[INFO] 기존 내부 의존성 제거 — `text-chunker.estimateTokens` import 삭제**
  - 위치: `agent-memory-injection.ts` line 12 (삭제된 라인)
  - 상세: `import { estimateTokens } from '../../../modules/knowledge-base/chunking/text-chunker'` 가 제거되었다. memory 경로와 KB 청킹 경로의 결합이 끊어지고, 각 경로가 독립적인 추정 로직을 갖는다. 회귀 0이라는 주석은 spec 파일(`agent-memory-injection.spec.ts`)의 `kbEstimateTokens` 분리 테스트로 증명된다.
  - 제안: 현재 상태 유지. 향후 provider tokenizer-exact (v3 로드맵, spec §12.10) 도입 시 이 함수만 교체하면 되므로 분리가 적절하다.

- **[INFO] 표준 JS API 전용 구현 확인**
  - 위치: `agent-memory-injection.ts` line 77–79 (`estimateTokensLanguageAware`)
  - 상세: 코드포인트 분류에 `String.prototype.codePointAt(0)` + `for...of` 이터레이션만 사용한다. 정규식, 외부 패키지, Node.js 전용 API 없음. 서로게이트 페어(이모지 등)도 `for...of` 가 코드포인트 단위로 처리하므로 안전하다.
  - 제안: 현재 상태 유지.

- **[INFO] 테스트 내 `text-chunker` import 는 분리 증명 용도**
  - 위치: `agent-memory-injection.spec.ts` (추가된 import `kbEstimateTokens`)
  - 상세: 테스트 파일에서만 `text-chunker.estimateTokens` 를 import 해 "KB 청킹 경로는 여전히 `char/3`" 임을 회귀 테스트로 검증한다. 프로덕션 코드 의존성이 아니므로 번들 크기나 라이선스에 영향 없음.
  - 제안: 현재 상태 유지.

---

## 요약

이번 변경은 의존성 관점에서 완전히 중립이다. `package.json` 및 모든 lockfile 에 변경이 없고, 새로 추가된 외부 패키지는 0건이다. 반대로 기존 내부 의존성(`text-chunker.estimateTokens`)을 memory 경로에서 분리함으로써 두 경로 간 결합이 줄었다. 구현은 `String.codePointAt` + `for...of` 등 표준 ECMAScript API 만 사용하며, js-tiktoken·gpt-tokenizer 등 외부 tokenizer 라이브러리 흔적은 구현 파일과 패키지 매니페스트 어디에도 없다. A4 lite "무의존 휴리스틱" 결정이 코드 레벨에서 그대로 이행되었다.

---

## 위험도

NONE

---

BLOCK: NO
