# 의존성(Dependency) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 코드베이스의 의존성을 면밀히 검토한다.

## 사용자 강조 관점

병렬 작업으로 인한 의존성 폭증·중복 위험:

1. **일관성** — 동일 기능의 라이브러리 중복 (예: date-fns + dayjs)
2. **스펙 준수** — npm 사용 강제 (yarn/pnpm 금지)
3. **보안** — CVE, 유지보수 중단 라이브러리
4. **리팩토링** — 사용 거의 안 되는 dep 정리

## 최근 병렬 작업 컨텍스트

- cafe24 followup 에서 새로 추가된 dep 가능 (crypto, redis nonce 등)
- frontend `package.json` 과 backend `package.json` 의 독립적 진화

## 검토 범위

- `backend/package.json`, `backend/package-lock.json`
- `frontend/package.json`, `frontend/package-lock.json`
- `packages/expression-engine/package.json`, `packages/node-summary/package.json`
- `Makefile`, `docker-compose*.yml` (있다면) — 인프라 의존
- `spec/conventions/` 패키지 매니저 규약

## 작업 지침

1. **새 의존성 정당화**: 큰 라이브러리가 작은 기능 때문에 추가되었나
2. **버전 고정**: caret(`^`) vs exact, peer dep 충돌
3. **라이선스**: GPL/AGPL 등 카피레프트, MIT/BSD 등 허용형
4. **취약점**: `npm audit` 가능하면 실행
5. **번들 크기**: frontend dep 중 큰 것 (moment, lodash 전체)
6. **중복**: 같은 기능의 다른 라이브러리 (axios + fetch wrapper, date-fns + dayjs)
7. **deprecation**: 공식 deprecated 라이브러리
8. **빌드 도구 일관성**: TS/ESM 설정
9. **lock 파일 일관성**: lock 파일이 package.json 과 정합

`npm audit --json` 시도 가능. 시간 길면 timeout 짧게.

## 출력 형식

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <path>:<line>
  - 상세
  - 제안

### 요약
1 문단

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: 알려진 CVE 또는 라이선스 위반. WARNING: 중복·deprecation. INFO: 정리 권고.
